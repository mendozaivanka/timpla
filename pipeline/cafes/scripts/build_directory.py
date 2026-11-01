"""
Timpla directory (PLAN-v2, Option 1): every independent café in Metro Manila that at least one
source has seen recently, with specialty as a badge on top.

Inputs
  sources/osm_ncr_cafes_meta_2026-10-21.json   OSM cafés with edit metadata (query: sources/raw/osm_cafes_meta.ql)
  sources/overture_ncr_cafes_2026-09-23.1.json Overture Places (scripts/fetch_overture_cafes.py)
  cafes.csv                                    specialty layer (scripts/build_dataset.py, run that first)
  data/chains.psv, data/osm_exclusions.psv, data/timeline.psv, data/ncr_adm3.geojson

Outputs
  directory.csv / directory.geojson   one row per branch: specialty, independent or multi-branch
  osm_layer.json                      the rest of OSM's independents, status unverified (map background layer)
  qa_directory.md                     counts per class, evidence level and city; noise removed per rule; chain log

Rules
  class        specialty    passes build_dataset.py's rules (NCR, specialty, open); keeps its tier
               multibranch  4-9 deduplicated NCR locations under one name, no chain-list match
               independent  no chain signal found (not a verified ownership check)
               chain        chains.psv match or >= 10 locations; never in the directory
  open evidence, strongest first; independents need level 1-3 to enter
               1 editorial_2025_26  the specialty layer's status rule
               2 osm_check          OSM check_date / survey:date >= 2024-01-01
               3 overture_2026_09   a same-name Overture place within 150 m in the 2026-09 release, with
                                    confidence >= 0.6 and the café's own website or social account
               4 osm_only           OSM only, no date -> osm_layer.json, not the directory
"""
import csv, json, os, re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from math import cos, radians, hypot

from common import ROOT, DATA, canonical, norm, read_psv, to_float, ncr, point_in_geom, clean_city, city_in_ncr

OSM_PATH = os.path.join(ROOT, "sources", "osm_ncr_cafes_meta_2026-10-21.json")
OVT_PATH = os.path.join(ROOT, "sources", "overture_ncr_cafes_2026-09-23.1.json")
OVT_RELEASE = "2026-09"
MATCH_M = 150
CHAIN_MIN, MULTI_MIN = 10, 4
CHECK_SINCE = "2024-01-01"
# Level 3 alone failed the 30-row spot-check (2026-10-22: 7 closed / not cafés, 9 untraceable), so a page match
# now also needs Overture confidence >= 0.6 and the café's own website or social account (Ivanka's choice).
OVT_MIN_CONF = 0.6

def metres(a, b):
    """Equirectangular distance; fine at city scale."""
    k = 111_320
    return hypot((a[0] - b[0]) * k, (a[1] - b[1]) * k * cos(radians(a[0])))

# ───────── NCR membership (bbox prefilter, then the ADM3 polygons) ─────────
def bbox(geom):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    xs = [p[0] for poly in polys for p in poly[0]]
    ys = [p[1] for poly in polys for p in poly[0]]
    return min(xs), min(ys), max(xs), max(ys)
NCR_UNITS = [(bbox(f["geometry"]), f) for f in ncr]
def ncr_city(lat, lon):
    for (x0, y0, x1, y1), f in NCR_UNITS:
        if x0 <= lon <= x1 and y0 <= lat <= y1 and point_in_geom(lon, lat, f["geometry"]):
            return clean_city(f["properties"].get("shapeName"))
    return None

# ───────── Name matching ─────────
def same_name(a, b):
    """Normalised names equal, one a whole-word prefix of the other, or close spelling."""
    if not a or not b:
        return False
    if a == b:
        return True
    short, long_ = sorted((a, b), key=len)
    if len(short) >= 4 and (long_ + " ").startswith(short + " "):
        return True
    return len(short) >= 5 and SequenceMatcher(None, a, b).ratio() >= 0.85

class Grid:
    """Points bucketed in ~220 m cells so 150 m lookups only scan the 3x3 neighbourhood."""
    CELL = 0.002
    def __init__(self):
        self.cells = defaultdict(list)
    def key(self, lat, lon):
        return int(lat // self.CELL), int(lon // self.CELL)
    def add(self, lat, lon, item):
        self.cells[self.key(lat, lon)].append(((lat, lon), item))
    def near(self, lat, lon, m=MATCH_M):
        cy, cx = self.key(lat, lon)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for p, item in self.cells.get((cy + dy, cx + dx), ()):
                    if metres((lat, lon), p) <= m:
                        yield item

# ───────── Load ─────────
print("inputs:")
osm = json.load(open(OSM_PATH))["elements"]
ovt = json.load(open(OVT_PATH))
print(f"  {os.path.relpath(OSM_PATH, ROOT)}: {len(osm)} features")
print(f"  {os.path.relpath(OVT_PATH, ROOT)}: {len(ovt)} places")
chains = read_psv(os.path.join(DATA, "chains.psv"))
manual_excl = {r["osm_id"]: r.get("reason", "manual") for r in read_psv(os.path.join(DATA, "osm_exclusions.psv"))}
timeline = read_psv(os.path.join(DATA, "timeline.psv"))
spec_rows = list(csv.DictReader(open(os.path.join(ROOT, "cafes.csv"), encoding="utf-8")))
print(f"  cafes.csv: {len(spec_rows)} rows")

CHAIN_RULES = [(norm(c["name"]), c.get("match") or "prefix", c["name"], c.get("kind", "")) for c in chains]
def chain_listed(*names):
    for n in names:
        k = norm(n or "")
        if not k:
            continue
        for pat, how, label, kind in CHAIN_RULES:
            if k == pat or (how == "prefix" and (k + " ").startswith(pat + " ")):
                return label
    return None

closed_names = {norm(canonical(r["name"])) for r in timeline if r.get("event") == "closed" and not r.get("branch")}
closed_names -= {norm(canonical(r["name"])) for r in timeline if r.get("event") == "reopened"}

# ───────── Specialty layer ─────────
# Included rows become directory rows as they are. Excluded rows still matter: an OSM node with
# the name of a shop we found closed, or a roaster without a café, must not come back as "independent".
spec_in = [r for r in spec_rows if r["included"] == "yes"]
spec_keys = {norm(canonical(r["name"])) for r in spec_in}
blocked = {}
for r in spec_rows:
    if r["included"] == "yes":
        continue
    reasons = r["exclusion_reasons"]
    k = norm(canonical(r["name"]))
    if k in spec_keys:
        continue  # another branch of an included shop; the shop is fine
    if "status_closed" in reasons or "no_physical_cafe" in reasons or "outside_ncr" in reasons:
        blocked[k] = reasons
for k in closed_names:
    if k not in spec_keys:
        blocked.setdefault(k, "closed (timeline.psv)")
def spec_shop(key):
    return next((s for s in spec_keys if same_name(key, s)), None)

# ───────── Overture index ─────────
OVT_CATS = {"cafe", "coffee_shop", "tea_room", "coffee_roastery", "bakery_cafe"}
ovt_grid = Grid()
for o in ovt:
    if o["cat"] in OVT_CATS and o.get("lat") and o.get("name"):
        o["_k"] = norm(o["name"])
        ovt_grid.add(o["lat"], o["lon"], o)
def overture_match(lat, lon, key, raw):
    best = None
    for o in ovt_grid.near(lat, lon):
        ok = same_name(key, o["_k"]) if key else o["name"].strip().lower() == raw.strip().lower()
        if ok and (best is None or o["confidence"] > best["confidence"]):
            best = o
    return best

# ───────── OSM features → candidates ─────────
NOT_CAFE_NAME = re.compile(r"\b(milk ?tea|milktea|boba|pisonet|computer|internet|gaming|e-?sports)\b", re.I)
FOOD_NAME = re.compile(r"\b(restaurant|grill|bistro|eatery|carinderia|carenderia|diner|pub|bar|kitchen|resto|lugawan|tapsilogan)\b", re.I)
COFFEE_WORD = re.compile(r"\b(coffee|caf[eé]|espresso|kape|kapihan|brew|roast)", re.I)
HOTEL_NAME = re.compile(r"\b(lounge|lobby|hotel)\b", re.I)
NOT_CAFE_CUISINE = {"bubble_tea", "donut", "ice_cream", "tea", "cake", "pastry", "dessert"}

removed = Counter()       # noise rule -> count
removed_names = defaultdict(list)
cands = []
for e in osm:
    t = e.get("tags", {})
    name = (t.get("name") or t.get("name:en") or "").strip()
    lat = e.get("lat") or (e.get("center") or {}).get("lat")
    lon = e.get("lon") or (e.get("center") or {}).get("lon")
    osm_id = f"{e['type'][0]}{e['id']}"
    def drop(rule):
        removed[rule] += 1
        if len(removed_names[rule]) < 12:
            removed_names[rule].append(name or osm_id)
    if not name:
        drop("unnamed"); continue
    if lat is None:
        drop("no coordinates"); continue
    city = ncr_city(lat, lon)
    if not city:
        drop("outside NCR"); continue
    if osm_id in manual_excl:
        drop("manual exclusion (data/osm_exclusions.psv)"); continue
    cuisines = set((t.get("cuisine") or "").replace(" ", "").split(";")) - {""}
    coffee_cuisine = bool(cuisines & {"coffee_shop", "coffee"})
    key = norm(name)
    ov = overture_match(lat, lon, key, name)
    ov_cafe = bool(ov and ov["cat"] in ("cafe", "coffee_shop", "coffee_roastery"))
    if cuisines & NOT_CAFE_CUISINE and not coffee_cuisine:
        drop("tea / dessert / donut cuisine"); continue
    if NOT_CAFE_NAME.search(name):
        drop("milk tea / internet café name"); continue
    if t.get("amenity") == "fast_food" and not coffee_cuisine:
        drop("fast food"); continue
    if t.get("shop") == "bakery" or t.get("shop") == "pastry":
        drop("bakery"); continue
    looks_food = t.get("amenity") == "restaurant" or FOOD_NAME.search(name)
    if looks_food and not (coffee_cuisine or ov_cafe or COFFEE_WORD.search(name)):
        drop("restaurant / bar"); continue
    addr_city = clean_city(t.get("addr:city", ""))
    if addr_city and city_in_ncr(addr_city):
        city = addr_city  # BGC: the polygon says Makati, the address says Taguig
    # Only ISO dates count; free text like "April 2025" would sort above "2024-…" as a string
    check = max((t.get(k, "")[:10] for k in ("check_date", "survey:date", "check_date:opening_hours")
                 if re.match(r"\d{4}-\d{2}", t.get(k, ""))), default="")
    ig = t.get("contact:instagram") or t.get("instagram") or ""
    cands.append(dict(
        osm_id=osm_id, name=name, key=key, lat=round(lat, 7), lon=round(lon, 7), city=city,
        brand=t.get("brand", ""), cuisine=";".join(sorted(cuisines)), check=check,
        edited=e.get("timestamp", "")[:10], website=t.get("website") or t.get("contact:website") or "",
        instagram=ig, facebook=t.get("contact:facebook") or t.get("facebook") or "",
        hotel=bool(HOTEL_NAME.search(name)), ov=ov,
        own_presence=bool(t.get("website") or t.get("contact:website") or ig or t.get("contact:facebook")
                          or t.get("facebook") or (ov and ov.get("nweb"))),
    ))

# Dedupe OSM against itself (a node and a building way for one café): same name within 150 m
osm_grid, osm_kept = Grid(), []
for c in sorted(cands, key=lambda c: (c["check"], c["ov"] is not None), reverse=True):
    if any(same_name(c["key"], d["key"]) if c["key"] else c["name"] == d["name"] for d in osm_grid.near(c["lat"], c["lon"])):
        removed["duplicate within 150 m"] += 1
        continue
    osm_grid.add(c["lat"], c["lon"], c)
    osm_kept.append(c)

# ───────── Location counts per name (OSM + Overture, deduplicated within 150 m) ─────────
loc_grid = defaultdict(Grid)
loc_count = Counter()
# "Coffee Spot", "Coffee Corner": norm() strips "coffee", leaving a word many unrelated shops share
GENERIC = {"spot", "corner", "street", "shop", "station", "place", "hub", "nook", "stop", "cup", "lab", "break",
           "time", "express", "tambayan", "kapihan", "kape", "brew", "brews", "cafe", "beans", "bean", "tea"}
def count_location(key, lat, lon):
    if len(key) < 3 or key in GENERIC:
        return  # "The Coffee" normalises to nothing; generic names are not brands
    g = loc_grid[key]
    if not any(True for _ in g.near(lat, lon)):
        g.add(lat, lon, 1)
        loc_count[key] += 1
for c in osm_kept:
    count_location(norm(c["brand"]) or c["key"], c["lat"], c["lon"])
for cell in ovt_grid.cells.values():
    for (lat, lon), o in cell:
        if o["cat"] in ("cafe", "coffee_shop", "coffee_roastery") and ncr_city(lat, lon):
            count_location(o["_k"], lat, lon)
def locations(c):
    return max(loc_count.get(norm(c["brand"]), 0), loc_count.get(c["key"], 0))

# ───────── Classify ─────────
directory, layer, chain_hits, multi_hits = [], [], Counter(), Counter()
spec_by_shop = defaultdict(list)
for r in spec_in:
    spec_by_shop[norm(canonical(r["name"]))].append(r)
spec_osm_ids = defaultdict(str)  # specialty branch index -> matched osm id

for c in osm_kept:
    shop = spec_shop(norm(canonical(c["name"]))) or spec_shop(c["key"]) or (spec_shop(norm(c["brand"])) if c["brand"] else None)
    if shop:
        # A branch we already list? Then the OSM node only lends its id. Otherwise it is another branch of a
        # specialty shop that curation did not list (often closed or moved), so it goes to the background layer.
        hit = next((i for i, r in enumerate(spec_by_shop[shop])
                    if r["lat"] and metres((float(r["lat"]), float(r["lon"])), (c["lat"], c["lon"])) <= MATCH_M), None)
        if hit is not None:
            spec_osm_ids[(shop, hit)] = c["osm_id"]
        else:
            layer.append(c)
        continue
    if blocked.get(c["key"]) or any(same_name(c["key"], b) for b in blocked):
        removed["closed / not a café per editorial check"] += 1
        continue
    listed = chain_listed(c["name"], c["brand"])
    n = locations(c)
    if listed or n >= CHAIN_MIN:
        chain_hits[listed or f"{c['name']} ({n} locations)"] += 1
        continue
    c["cls"] = "multibranch" if n >= MULTI_MIN and c["key"] not in GENERIC else "independent"
    c["locations"] = n
    if c["cls"] == "multibranch":
        multi_hits[f"{c['name']} ({n})"] += 1
    if c["check"] >= CHECK_SINCE:
        c["evidence"], c["evidence_date"] = "osm_check", c["check"]
    elif c["ov"] and c["ov"]["confidence"] >= OVT_MIN_CONF and c["own_presence"]:
        c["evidence"], c["evidence_date"] = "overture_2026_09", OVT_RELEASE
    else:
        c["evidence"], c["evidence_date"] = "osm_only", ""
        layer.append(c)
        continue
    directory.append(c)

def ig_handle(s):
    s = (s or "").strip().rstrip("/")
    return ("@" + s.split("/")[-1].lstrip("@")) if s else ""

rows = []
for shop, branches in spec_by_shop.items():
    for i, r in enumerate(branches):
        rows.append(dict(
            directory_id=f"s:{shop.replace(' ', '-')}:{i}", osm_id=spec_osm_ids.get((shop, i), ""), overture_id="",
            name=r["name"], branch=r["branch"], lat=r["lat"], lon=r["lon"], city=r["city"],
            cls="specialty", tier=r["tier"], locations=len(branches), hotel="",
            open_evidence="editorial_2025_26", evidence_date="2025-26", evidence_note=r["status_evidence"][:160],
            cuisine="", website=r["website"], instagram=r["instagram"], shop=r["name"], notes="",
        ))
for c in directory:
    rows.append(dict(
        directory_id=f"o:{c['osm_id']}", osm_id=c["osm_id"], overture_id=(c["ov"] or {}).get("id", ""),
        name=c["name"], branch="", lat=c["lat"], lon=c["lon"], city=c["city"],
        cls=c["cls"], tier="", locations=c["locations"], hotel="yes" if c["hotel"] else "",
        open_evidence=c["evidence"], evidence_date=c["evidence_date"],
        evidence_note=("OSM check " + c["check"]) if c["evidence"] == "osm_check" else "Overture place (Meta page) in the 2026-09 release",
        cuisine=c["cuisine"], website=c["website"], instagram=ig_handle(c["instagram"]), shop="", notes="",
    ))
rows.sort(key=lambda r: (r["city"], r["name"].lower(), r["branch"]))

# ───────── Write ─────────
COLS = list(rows[0].keys())
with open(os.path.join(ROOT, "directory.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=COLS)
    w.writeheader()
    w.writerows(rows)
feats = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [float(r["lon"]), float(r["lat"])]},
          "properties": {k: r[k] for k in COLS if k not in ("lat", "lon")}} for r in rows if r["lat"]]
json.dump({"type": "FeatureCollection", "features": feats}, open(os.path.join(ROOT, "directory.geojson"), "w"), ensure_ascii=False)
json.dump([{"name": c["name"], "lon": c["lon"], "lat": c["lat"], "edited": c["edited"]} for c in layer],
          open(os.path.join(ROOT, "osm_layer.json"), "w"), ensure_ascii=False)

cls_n = Counter(r["cls"] for r in rows)
ev_n = Counter(r["open_evidence"] for r in rows)
city_n = Counter(r["city"] for r in rows)
shops = len({(r["cls"], r["shop"] or r["directory_id"]) for r in rows})
qa = [f"# Directory QA\n",
      f"Built from OSM (edits to 2026-10-21) and Overture {OVT_RELEASE}. Rules: see the docstring of `scripts/build_directory.py`.\n",
      f"**{len(rows)} branches, {shops} shops** ({sum(1 for r in rows if not r['lat'])} without coordinates). "
      f"Background layer (OSM only, status unverified): {len(layer)}.\n",
      "## By class\n", *[f"- {k}: {v}" for k, v in cls_n.most_common()],
      "\n## By open evidence\n", *[f"- {k}: {v}" for k, v in ev_n.most_common()],
      "\n## By city\n", *[f"- {k}: {v}" for k, v in city_n.most_common()],
      "\n## Removed before classification\n", *[f"- {k}: {v} (e.g. {', '.join(removed_names[k][:6])})" if removed_names[k] else f"- {k}: {v}" for k, v in removed.most_common()],
      f"\n## Chains removed ({sum(chain_hits.values())} OSM features)\n", *[f"- {k}: {v}" for k, v in chain_hits.most_common()],
      f"\n## Multi-branch ({MULTI_MIN}-{CHAIN_MIN - 1} locations), kept and labelled\n", *[f"- {k}: {v}" for k, v in multi_hits.most_common()],
      "\n## Names with >= 4 locations (review for chains.psv)\n",
      *[f"- {k}: {v}" for k, v in loc_count.most_common() if v >= MULTI_MIN]]
open(os.path.join(ROOT, "qa_directory.md"), "w").write("\n".join(qa) + "\n")

print(f"\ndirectory: {len(rows)} branches / {shops} shops · {dict(cls_n)}")
print(f"evidence: {dict(ev_n)}")
print(f"background layer: {len(layer)} · removed: {dict(removed)} · chains: {sum(chain_hits.values())}")
