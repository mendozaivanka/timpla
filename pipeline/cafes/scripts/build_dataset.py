"""Assemble the Metro Manila specialty-café dataset.

Run from anywhere:  python3 scripts/build_dataset.py
Inputs  (data/):    editorial_list.psv          main branch-level list (21 columns)
                    indie_*.psv                 extra discovery files, same columns (+ optional community_signals)
                    status_updates.psv          optional overrides: name|branch_name|status_2026|status_evidence
                    timeline.psv, roaster_edges.psv, awards_events.psv, ncr_adm3.geojson
                    ../sources/osm_ncr_cafes.json   (OSM dump, used to fill missing coordinates)
Outputs (./):       cafes.csv (every candidate branch), cafes.geojson (included, mapped), qa_report.md

Hard rules (all must hold):
  1. inside Metro Manila  point-in-polygon against data/ncr_adm3.geojson (stated city when no coordinates)
  2. specialty            own roast, a named specialty roaster, or explicit specialty evidence
  3. currently open       2025–2026 evidence; any 'closed' event in the timeline overrides
Recognition is a TIER, not a filter (owner's request, 2026-10-21: include indie / lesser-known cafés):
  acclaimed   ≥2 independent editorial write-ups, or an award / World's 100 Best placing
  recognised  1 write-up, or roaster/award pedigree, or a community signal (festival roster, roaster stockist list…)
  indie       specialty and open, but no press yet
Google / Foursquare ratings are deliberately not used (their terms forbid storing them).
"""
import csv, glob, json, os, re, unicodedata
from collections import Counter, defaultdict

from common import *  # ROOT, DATA, ALIASES, canonical, norm, read_psv, to_float, ncr_unit, clean_city, city_in_ncr
OSM_PATH = os.path.join(ROOT, "sources", "osm_ncr_cafes.json")

# ───────── OSM name index for coordinate gaps ─────────
osm = json.load(open(OSM_PATH))
osm = osm["elements"] if isinstance(osm, dict) else osm
osm_idx = defaultdict(list)
for e in osm:
    if e.get("tags", {}).get("name"):
        osm_idx[norm(e["tags"]["name"])].append(e)
def osm_coords(name):
    out = []
    for e in osm_idx.get(norm(name)) or []:
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lon = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat and lon:
            out.append((float(lat), float(lon)))
    return out

# ───────── Load ─────────
print("inputs:")
ed = read_psv(os.path.join(DATA, "editorial_list.psv"))
for p in sorted(glob.glob(os.path.join(DATA, "indie_*.psv"))):
    for r in read_psv(p):
        r["_source_file"] = os.path.basename(p)
        ed.append(r)
status_updates = {(norm(canonical(r.get("name", ""))), norm(r.get("branch_name", ""))): r
                  for r in read_psv(os.path.join(DATA, "status_updates.psv"))}
# Hand corrections: name|branch_name|field|value|reason. field = any input column, or "exclude" (value = reason)
corrections = defaultdict(list)
for c in read_psv(os.path.join(DATA, "corrections.psv")):
    corrections[(norm(canonical(c.get("name", ""))), norm(c.get("branch_name", "")))].append(c)
tl = read_psv(os.path.join(DATA, "timeline.psv"))
edges = read_psv(os.path.join(DATA, "roaster_edges.psv"))
awards = read_psv(os.path.join(DATA, "awards_events.psv"))

closed = {norm(canonical(r["name"])) for r in tl if r.get("event") == "closed" and not r.get("branch")}
closed_branches = {(norm(canonical(r["name"])), norm(r.get("branch", ""))) for r in tl if r.get("event") == "closed" and r.get("branch")}
reopened = {norm(canonical(r["name"])) for r in tl if r.get("event") == "reopened"}
closed -= reopened
opened_year = {}
for r in tl:
    if r.get("event") in ("opened", "reopened", "rebranded") and r.get("year", "").isdigit():
        k = norm(canonical(r["name"]))
        opened_year[k] = min(opened_year.get(k, 9999), int(r["year"]))

roasters_of, own_roast = defaultdict(set), set()
for e in edges:
    k = norm(canonical(e.get("cafe", "")))
    if e.get("relation") == "own_roast":
        own_roast.add(k)
    elif e.get("relation") in ("serves", "roasted_by", "wholesale_stockist"):
        roasters_of[k].add(e.get("roaster", ""))
award_names = {norm(r.get("affiliation", "")) for r in awards if r.get("kind") in ("pcqc", "barista")}
award_names.discard("")

FOREIGN = ("toby", "arabica", "common man", "kitsune", "coffee academics", "elephant grounds", "key coffee", "kissaten",
           "baristart", "omotesando", "st ali", "dean deluca", "kurasu", "blue bottle", "gloria jean", "tully")

# ───────── Merge rows: same (name, branch, address) from several files → fill empties, don't duplicate ─────────
merged, order = {}, []
for r in ed:
    name = canonical(r.get("name", ""))
    k = norm(name)
    if not k:
        continue
    key = (k, norm(r.get("branch_name", "")), norm(r.get("address", "")))
    if key in merged:
        cur = merged[key]
        for f, v in r.items():
            if v and not cur.get(f):
                cur[f] = v
        # endorsements and community signals accumulate across files
        if r.get("community_signals"):
            cur["community_signals"] = ";".join(filter(None, {*cur.get("community_signals", "").split(";"), *r["community_signals"].split(";")}))
        continue
    merged[key] = {**r, "name": name}
    order.append(key)

# ───────── Build rows ─────────
rows, dropped = [], Counter()
for key in order:
    r = merged[key]
    name, k = r["name"], key[0]
    forced_exclusion, forced = [], {}
    for c in corrections.get((k, key[1]), []) + (corrections.get((k, ""), []) if key[1] else []):
        if c["field"] == "exclude":
            forced_exclusion.append(c["value"])
        else:
            r[c["field"]] = c["value"]
            forced[c["field"]] = c["value"]
        r["notes"] = (r.get("notes", "") + f" [correction: {c['reason']}]").strip()

    lat, lon = to_float(r.get("lat")), to_float(r.get("lon"))
    coord_source = r.get("coord_source", "")
    if lat is None or lon is None:
        hits = osm_coords(name)
        if len(hits) == 1 or (hits and not r.get("branch_name")):
            lat, lon = hits[0]
            coord_source = "osm_name_match"
    unit = ncr_unit(lat, lon) if lat is not None else None
    if lat is not None:
        in_ncr = "yes" if unit else "no"
    else:
        in_ncr = "unknown" if not r.get("city") else ("yes" if city_in_ncr(r.get("city")) else "no")

    upd = status_updates.get((k, key[1])) or status_updates.get((k, ""))
    # Precedence: hand correction > status_updates.psv > the row itself
    status = (forced.get("status_2026") or (upd or {}).get("status_2026") or r.get("status_2026") or "unclear").lower()
    status_evidence = (forced.get("status_evidence") or ("correction" if "status_2026" in forced else "")
                       or (upd or {}).get("status_evidence") or r.get("status_evidence", ""))
    if k in closed or (k, key[1]) in closed_branches:
        status = "closed"

    endorsements = int(re.sub(r"\D", "", r.get("endorsements", "0")) or 0)
    specialty_evidence = r.get("specialty_evidence", "")
    pedigree = k in own_roast or k in award_names or bool(roasters_of.get(k))
    signals = [s for s in r.get("community_signals", "").split(";") if s.strip()]
    is_specialty = bool(specialty_evidence) or pedigree or r.get("type", "") in ("roaster", "cafe+roaster")
    world100 = "100 best" in (r.get("notes", "") + r.get("endorsement_sources", "")).lower()
    if endorsements >= 2 or world100:
        tier = "acclaimed"
    elif endorsements == 1 or pedigree or signals:
        tier = "recognised"
    else:
        tier = "indie"

    no_cafe = r.get("type", "") == "roaster" and lat is None and not r.get("address")
    reasons = []
    if in_ncr == "no": reasons.append("outside_ncr")
    # No coordinates and no stated city: we can't show it's in Metro Manila (festival/stockist names often aren't)
    if in_ncr == "unknown": reasons.append("location_unknown")
    if no_cafe: reasons.append("roaster_without_cafe")
    if not is_specialty: reasons.append("not_specialty")
    if status != "open": reasons.append(f"status_{status}")
    reasons += forced_exclusion
    for x in reasons: dropped[x] += 1

    blob = (k + " " + r.get("notes", "") + " " + r.get("type", "")).lower()
    foreign = any(x in blob for x in FOREIGN) or "foreign" in blob or "franchise" in blob

    rows.append({
        "name": name,
        "branch": r.get("branch_name", ""),
        "tier": tier,
        "type": r.get("type", "").replace(" (foreign franchise)", ""),
        "ownership": "foreign brand" if foreign else "local",
        "neighbourhood": r.get("neighbourhood", ""),
        # The polygon decides "inside NCR", but the stated city wins for the label: geoBoundaries still draws
        # Fort Bonifacio (BGC) and the EMBO barangays inside Makati, though the 2022 Supreme Court ruling gave them to Taguig.
        "city": clean_city(r.get("city", "")) if city_in_ncr(r.get("city", "")) else (unit or clean_city(r.get("city", ""))),
        "address": r.get("address", ""),
        "lat": lat if lat is not None else "",
        "lon": lon if lon is not None else "",
        "coord_source": coord_source,
        "in_ncr": in_ncr,
        "specialty": "yes" if is_specialty else "no",
        "specialty_evidence": specialty_evidence,
        "roaster_or_beans": r.get("roaster_or_beans") or ";".join(sorted(roasters_of.get(k, []))) or ("own roast" if k in own_roast else ""),
        "status_2026": status,
        "status_evidence": status_evidence,
        "endorsements": endorsements,
        "endorsement_sources": r.get("endorsement_sources", ""),
        "community_signals": ";".join(signals),
        "award_or_pedigree": "yes" if pedigree else "no",
        "first_opened_year": r.get("first_opened_year") or (opened_year.get(k) if opened_year.get(k, 9999) < 9999 else ""),
        "website": r.get("website", ""),
        "ordering_platform": r.get("ordering_platform", ""),
        "instagram": r.get("instagram", ""),
        "source_file": r.get("_source_file", "editorial_list.psv"),
        "included": "no" if reasons else "yes",
        "exclusion_reasons": ";".join(reasons),
        "notes": r.get("notes", ""),
    })

with open(os.path.join(ROOT, "cafes.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)

inc = [r for r in rows if r["included"] == "yes"]
feats = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
          "properties": {k: v for k, v in r.items() if k not in ("lat", "lon")}} for r in inc if r["lat"] != ""]
json.dump({"type": "FeatureCollection", "features": feats}, open(os.path.join(ROOT, "cafes.geojson"), "w"))

# ───────── QA report ─────────
shops_by_tier = defaultdict(set)
for r in inc:
    shops_by_tier[r["tier"]].add(r["name"])
# a shop takes its best tier across branches
best = {}
for t in ("indie", "recognised", "acclaimed"):
    for n in shops_by_tier[t]:
        best[n] = t
tier_counts = Counter(best.values())
lines = [
    "# Specialty cafés dataset: QA report", "",
    f"- Candidate branch rows: **{len(rows)}** ({len({r['name'] for r in rows})} shops)",
    f"- Included (inside NCR · specialty · open): **{len(inc)}** branches, **{len(best)}** shops",
    f"- By tier (shops): acclaimed {tier_counts['acclaimed']}, recognised {tier_counts['recognised']}, indie {tier_counts['indie']}",
    f"- With coordinates: {sum(1 for r in inc if r['lat'] != '')} / {len(inc)}",
    f"- Opening year known: {sum(1 for r in inc if r['first_opened_year'])} / {len(inc)}",
    f"- Foreign brands: {len({r['name'] for r in inc if r['ownership'] == 'foreign brand'})} shops",
    "", "## Exclusions (a row can have several reasons)", "",
] + [f"- {k}: {v}" for k, v in dropped.most_common()] + [
    "", "## Included branches by city", "",
] + [f"- {k or '(unknown)'}: {v}" for k, v in Counter(r["city"] for r in inc).most_common()] + [
    "", "## Sources of included rows", "",
] + [f"- {k}: {v}" for k, v in Counter(r["source_file"] for r in inc).most_common()] + [
    "", "## Roaster network", "",
    f"- edges: {len(edges)}; cafés with a named roaster: {len([k for k in roasters_of if roasters_of[k]])}; own-roast shops: {len(own_roast)}",
    "", "## Timeline", "",
    f"- events: {len(tl)}; closed events: {sum(1 for r in tl if r.get('event') == 'closed')}",
    "", "## Awards & events", "",
    f"- rows: {len(awards)}; by kind: " + ", ".join(f"{k}:{n}" for k, n in Counter(r.get('kind') for r in awards).items()),
]
open(os.path.join(ROOT, "qa_report.md"), "w").write("\n".join(lines) + "\n")
print("\n".join(lines))
