"""
Tanim data fetch: every series comes from PSA OpenSTAT's keyless PxWeb API, plus province outlines from
faeldon/philippines-json-maps. Tables are found by title, dimensions by label, so re-issued table ids and
re-ordered codes do not break the build. Output: ../data/*.json (committed), consumed by
tala-portfolio/scripts/build-tanim-data.ts.

Run: python3 scripts/fetch_psa.py            (about 120 API calls, paced to stay under 30 per 10 s)
"""
from __future__ import annotations
import csv, io, json, math, os, re, ssl, sys, time, urllib.request, urllib.error
from datetime import date
from pathlib import Path

# macOS Python ships without system CA certificates; certifi (installed with httpx) fills the gap
try:
    import certifi
    SSL = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL = ssl.create_default_context()

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "data"; RAW = HERE.parent / "raw"
OUT.mkdir(exist_ok=True); RAW.mkdir(exist_ok=True)
API = "https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB"
UA = {"User-Agent": "Mozilla/5.0 (tanim-data; portfolio side project)", "Accept": "application/json"}
CELL_BUDGET = 950
calls: list[float] = []
manifest: dict = {"retrievedAt": date.today().isoformat(), "tables": {}, "checks": []}

def pace():
    now = time.time(); calls.append(now)
    recent = [t for t in calls if now - t < 10]
    if len(recent) >= 28: time.sleep(10 - (now - recent[0]) + 0.2)
    time.sleep(0.35)

def get(path: str):
    pace()
    with urllib.request.urlopen(urllib.request.Request(f"{API}/{path}", headers=UA), timeout=60, context=SSL) as r:
        return json.loads(r.read().decode("utf-8-sig"))

def post(path: str, query: list, fmt: str = "csv", tries: int = 3):
    body = json.dumps({"query": query, "response": {"format": fmt}}).encode()
    for i in range(tries):
        pace()
        try:
            req = urllib.request.Request(f"{API}/{path}", data=body, headers={**UA, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120, context=SSL) as r:
                b = r.read()
            try: raw = b.decode("utf-8-sig")
            except UnicodeDecodeError: raw = b.decode("latin-1")  # a few PSA labels (Muñoz, Dasmariñas) come back in Latin-1
            return raw if fmt == "csv" else json.loads(raw)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and i < tries - 1: time.sleep(5 * (i + 1)); continue
            raise

def find_table(folder: str, pattern: str) -> dict:
    """Exactly one table in the folder whose title matches `pattern`; its id and PSA 'updated' stamp go in the manifest."""
    hits = [t for t in get(folder) if t.get("type") == "t" and re.search(pattern, t.get("text", ""), re.I)]
    if len(hits) != 1:
        raise SystemExit(f"table lookup for /{pattern}/ in {folder}: expected 1, got {[h['id'] for h in hits]}")
    t = hits[0]; manifest["tables"][t["id"]] = {"folder": folder, "title": t["text"], "updated": t.get("updated")}
    return {"path": f"{folder}/{t['id']}", "id": t["id"], "title": t["text"], "updated": t.get("updated")}

def meta(path: str) -> dict:
    # the import tables omit the Commodity Code value list (positional indices only); treat it as empty
    m = get(path); return {v["code"]: list(zip(v.get("values", []), v.get("valueTexts", []))) for v in m["variables"]}

def codes(vals, pattern: str, flags=re.I) -> list[str]:
    return [c for c, t in vals if re.search(pattern, t, flags)]

def num(v):
    try: return float(v)
    except (TypeError, ValueError): return None

def clean(label: str) -> str:
    return re.sub(r"\s+[a-z0-9]/$", "", label.lstrip(".")).strip()

def parse_csv(raw: str):
    rows = list(csv.reader(io.StringIO(raw))); return rows[0], rows[1:]

def chunks(xs, n):
    for i in range(0, len(xs), n): yield xs[i:i + n]

# ───────── 1. Crops by province, by variety (production, area, bearing trees) ─────────
def cached(name):
    f = RAW / f"{name}.json"
    if f.exists() and not os.environ.get("FORCE"):
        print(f"reusing raw/{name}.json (FORCE=1 to refetch)", file=sys.stderr); return json.loads(f.read_text())
    return None

def crops_table(folder, title_pat, crop_pat, measure):
    t = find_table(folder, title_pat)
    c = cached(measure)
    if c is not None: return t, c
    m = meta(t["path"])
    crop_codes = {c: clean(l) for c, l in m["Crop"] if re.search(crop_pat, l, re.I)}
    years = m["Year"]; annual = codes(m["Period"], r"^Annual$")
    assert annual, f"{t['id']}: no Annual period"
    out: dict[str, dict[str, dict[str, float | None]]] = {}  # geo label -> variety -> year -> value
    per_call = max(1, CELL_BUDGET // (len(crop_codes) * len(m["Geolocation"])))
    for ys in chunks(years, per_call):
        raw = post(t["path"], [
            {"code": "Crop", "selection": {"filter": "item", "values": list(crop_codes)}},
            {"code": "Geolocation", "selection": {"filter": "all", "values": ["*"]}},
            {"code": "Year", "selection": {"filter": "item", "values": [y for y, _ in ys]}},
            {"code": "Period", "selection": {"filter": "item", "values": annual}},
        ])
        hdr, rows = parse_csv(raw)
        for r in rows:
            crop, geo = r[0], r[1]
            key = geo if geo.startswith(".") or geo == "PHILIPPINES" else geo
            d = out.setdefault(key, {}).setdefault(variety_of(crop), {})
            for h, v in zip(hdr[2:], r[2:]):
                d[h[:4]] = num(v)
    (RAW / f"{measure}.json").write_text(json.dumps(out))
    return t, out

def variety_of(crop_label: str) -> str:
    l = crop_label.lower()
    for v in ("arabica", "excelsa", "liberica", "robusta"):
        if v in l: return v
    return "all" if "coffee" in l and "others" not in l else "others"

# ───────── 2. Farmgate by province ─────────
def farmgate():
    t = find_table("2M/NFG", r"^Commercial Crops: Farmgate Prices by Commodity, Region and Province")
    c = cached("farmgate")
    if c is not None: return t, c
    m = meta(t["path"])
    com = {c: clean(l) for c, l in m["Commodity"] if "coffee" in l.lower() or re.search(r"arabica|robusta|excelsa|liberica", l, re.I)}
    annual = codes(m["Period"], r"^Annual$"); years = m["Year"]
    out = {}
    per_call = max(1, CELL_BUDGET // (len(com) * len(m["Geolocation"])))
    for ys in chunks(years, per_call):
        hdr, rows = parse_csv(post(t["path"], [
            {"code": "Geolocation", "selection": {"filter": "all", "values": ["*"]}},
            {"code": "Commodity", "selection": {"filter": "item", "values": list(com)}},
            {"code": "Year", "selection": {"filter": "item", "values": [y for y, _ in ys]}},
            {"code": "Period", "selection": {"filter": "item", "values": annual}},
        ]))
        # columns follow the query order: geolocation, commodity, then one column per year
        for r in rows:
            d = out.setdefault(r[0], {}).setdefault(variety_of(r[1]), {})
            for h, v in zip(hdr, r):
                if re.match(r"^\d{4}", h): d[h[:4]] = num(v)
    (RAW / "farmgate.json").write_text(json.dumps(out)); return t, out

# ───────── 3. National: SUA, SSR, IDR, value of production ─────────
def national_series():
    res = {}
    t = find_table("2B/AA/SU", r"Commercial Crops: Supply Utilization Accounts"); m = meta(t["path"])
    cc = codes(m["Commodity"], r"^Coffee$")
    hdr, rows = parse_csv(post(t["path"], [
        {"code": "Commodity", "selection": {"filter": "item", "values": cc}},
        {"code": "Year", "selection": {"filter": "all", "values": ["*"]}},
        {"code": "Item", "selection": {"filter": "all", "values": ["*"]}}]))
    sua = {}
    ii = next((i for i, h in enumerate(hdr) if "item" in h.lower()), 1)
    for r in rows:
        item = clean(r[ii]); sua[item] = {h: num(v) for h, v in zip(hdr, r) if re.match(r"^\d{4}", h)}
    res["sua"] = {"table": t["id"], "items": sua}
    for key, pat in (("ssr", r"Self-Sufficiency Ratio"), ("idr", r"Import Dependency Ratio")):
        t = find_table("2B/AA/AFIS", pat); m = meta(t["path"])
        hdr, rows = parse_csv(post(t["path"], [
            {"code": "Commodity", "selection": {"filter": "item", "values": codes(m["Commodity"], r"^Coffee$")}},
            {"code": "Year", "selection": {"filter": "all", "values": ["*"]}}]))
        res[key] = {"table": t["id"], "years": {h: num(v) for h, v in zip(hdr, rows[0]) if re.match(r"^\d{4}", h)}}
    t = find_table("2B/AA/VP/NA", r"^Value of Production in Philippine Agriculture and Fisheries"); m = meta(t["path"])
    hdr, rows = parse_csv(post(t["path"], [
        {"code": "Type of Valuation", "selection": {"filter": "all", "values": ["*"]}},
        {"code": "Subsector", "selection": {"filter": "item", "values": codes(m["Subsector"], r"^\.*Coffee$")}},
        {"code": "Year", "selection": {"filter": "all", "values": ["*"]}},
        {"code": "Period", "selection": {"filter": "item", "values": codes(m["Period"], r"January to December")}}]))
    vp = {}
    for r in rows:
        key = "current" if "current" in r[0].lower() else "constant2018"
        vp[key] = {h[:4]: num(v) for h, v in zip(hdr, r) if re.match(r"^\d{4}", h)}
    res["valueOfProduction"] = {"table": t["id"], "millionPesos": vp}
    return res

# ───────── 4. CPI coffee by province, FIES coffee share ─────────
def cpi():
    t = find_table("2M/PI/CPI/2018NEW", r"^Consumer Price Index for All Income Households by Commodity Group \(2018=100\): January 2018")
    c = cached("cpi")
    if c is not None: return t, c
    m = meta(t["path"])
    com = codes(m["Commodity Description"], r"^01\.2\.2 - Coffee and coffee substitutes")
    ave = codes(m["Period"], r"^Ave$"); years = m["Year"]; geos = m["Geolocation"]
    out = {}
    per_call = max(1, CELL_BUDGET // len(geos))
    for ys in chunks(years, per_call):
        hdr, rows = parse_csv(post(t["path"], [
            {"code": "Geolocation", "selection": {"filter": "all", "values": ["*"]}},
            {"code": "Commodity Description", "selection": {"filter": "item", "values": com}},
            {"code": "Year", "selection": {"filter": "item", "values": [y for y, _ in ys]}},
            {"code": "Period", "selection": {"filter": "item", "values": ave}}]))
        for r in rows:
            d = out.setdefault(r[0], {})
            for h, v in zip(hdr[2:], r[2:]):
                if num(v) is not None: d[h[:4]] = num(v)
    (RAW / "cpi.json").write_text(json.dumps(out)); return t, out

def fies():
    t = find_table("1E/IE", r"Total Annual Family Expenditure by Major Expenditure Group by Per Capita Income Decile and by Region, Province, and HUC: 2023")
    c = cached("fies")
    if c is not None: return t, c
    m = meta(t["path"])
    grp = codes(m["Major Expenditure Group"], r"Coffee and Coffee Substitute"); geo_key = [k for k in m if k.startswith("Region")][0]
    out = {}
    for inds in chunks(m["Indicator"], 6):
        hdr, rows = parse_csv(post(t["path"], [
            {"code": geo_key, "selection": {"filter": "all", "values": ["*"]}},
            {"code": "Major Expenditure Group", "selection": {"filter": "item", "values": grp}},
            {"code": "Indicator", "selection": {"filter": "item", "values": [c for c, _ in inds]}}]))
        for r in rows:
            d = out.setdefault(r[0], {})
            for h, v in list(zip(hdr, r))[2:]:
                if num(v) is not None: d[h] = num(v)
    (RAW / "fies.json").write_text(json.dumps(out)); return t, out

# ───────── 5. Imports by origin: two-step positional recipe, one table per year ─────────
HS_GROUPS = {"green": ("090111", "090112"), "roasted": ("090121", "090122"), "extracts": ("210111",), "preparations": ("210112",), "other": ("090190",)}
def imports():
    folder = "2L/IMT/AVI"; tables = [t for t in get(folder) if re.search(r"Annual Value of Philippine Imports by Commodity and Country of Origin", t.get("text", ""), re.I)]
    out = {}
    for t in tables:
        year = re.search(r"(\d{4})\s*$", t["text"])
        if not year or int(year.group(1)) < 2016: continue
        y = year.group(1); path = f"{folder}/{t['id']}"; manifest["tables"][t["id"]] = {"folder": folder, "title": t["text"], "updated": t.get("updated")}
        m = meta(path)
        country_codes = m["Country"]; value_codes = m["Value"]
        kg = codes(value_codes, r"gross kilo"); usd = codes(value_codes, r"CIF")
        # step 1: commodity labels via json-stat (one country, one value) → positional index → 11-digit code
        js = post(path, [
            {"code": "Commodity Code", "selection": {"filter": "all", "values": ["*"]}},
            {"code": "Country", "selection": {"filter": "item", "values": [country_codes[0][0]]}},
            {"code": "Year", "selection": {"filter": "all", "values": ["*"]}},
            {"code": "Value", "selection": {"filter": "item", "values": usd[:1]}}], fmt="json-stat")
        ds = js["dataset"]; dim = ds["dimension"]
        ckey = next(k for k in dim if "commodity" in k.lower())
        cat = dim[ckey]["category"]
        index = cat["index"]; label = cat.get("label", {})
        keys = list(index) if isinstance(index, dict) else index
        idx_to_code = {str(index[k]) if isinstance(index, dict) else str(i): str(label.get(k, k)) for i, k in enumerate(keys)}
        wanted = {}
        for idx, label in idx_to_code.items():
            code = re.sub(r"\D", "", label)[:11]
            for form, prefixes in HS_GROUPS.items():
                if code.startswith(prefixes): wanted[idx] = (code, form)
        # step 2: those lines, every country, kg and usd
        js2 = post(path, [
            {"code": "Commodity Code", "selection": {"filter": "item", "values": list(wanted)}},
            {"code": "Country", "selection": {"filter": "all", "values": ["*"]}},
            {"code": "Year", "selection": {"filter": "all", "values": ["*"]}},
            {"code": "Value", "selection": {"filter": "item", "values": kg + usd}}], fmt="json")
        cnames = dict(country_codes); vnames = dict(value_codes)
        rows = []
        for cell in js2["data"]:
            k = cell["key"]; v = num(cell["values"][0])
            if v is None: continue
            code, form = wanted.get(k[0], (k[0], "?"))
            rows.append({"line": code, "form": form, "country": k[1], "countryName": cnames.get(k[1], k[1]), "measure": "kg" if "kilo" in vnames.get(k[3], "").lower() else "usd", "value": v})
        out[y] = rows
        print(f"imports {y}: {len(wanted)} coffee lines, {len(rows)} cells", file=sys.stderr)
    (RAW / "imports.json").write_text(json.dumps(out)); return out

# ───────── 6. Boundaries ─────────
def boundaries():
    base = "https://api.github.com/repos/faeldon/philippines-json-maps/contents/2023/geojson/regions/lowres"
    with urllib.request.urlopen(urllib.request.Request(base, headers={"User-Agent": UA["User-Agent"]}), timeout=60, context=SSL) as r:
        files = json.loads(r.read())
    feats = []
    for f in files:
        if not f["name"].startswith("provdists-region-"): continue
        with urllib.request.urlopen(urllib.request.Request(f["download_url"], headers={"User-Agent": UA["User-Agent"]}), timeout=120, context=SSL) as r:
            gj = json.loads(r.read())
        feats += [ft for ft in gj.get("features", []) if ft.get("geometry")]
    (RAW / "provdists.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
    manifest["boundaries"] = {"source": "faeldon/philippines-json-maps 2023, provdists lowres", "licence": "MIT", "psgc": "2023-12-31", "features": len(feats)}
    return feats

if __name__ == "__main__":
    t0 = time.time()
    prod_t, prod = crops_table("2E/CS", r"^Non-Food and Industrial Crops: Volume of Production, by Region, Province", r"coffee.*green coffee beans|^Coffee \(green coffee beans\)", "production")
    area_t, area = crops_table("2E/CS", r"^Non-Food and Industrial Crops: Area Planted/Harvested, by Region, Province", r"coffee", "area")
    tree_t, trees = crops_table("2E/CS", r"^Non-Food and Industrial Crops: Number of Bearing Trees/Hills/Vines, by Region, Province", r"coffee", "trees")
    fg_t, fg = farmgate()
    nat = national_series()
    cpi_t, cpi_d = cpi()
    fies_t, fies_d = fies()
    imp = imports()
    feats = boundaries()
    # checks: national row equals sum of regions within 0.5 %
    for name, series in (("production", prod), ("area", area), ("trees", trees)):
        ph = series.get("PHILIPPINES", {}).get("all", {})
        regions = [v for k, v in series.items() if k.startswith("..") and not k.startswith("....")]
        for y in ("2024", "2025"):
            tot = sum((r.get("all", {}).get(y) or 0) for r in regions); nat_v = ph.get(y)
            ok = nat_v and abs(tot - nat_v) / nat_v < 0.005
            manifest["checks"].append({"check": f"{name} {y}: regions sum to national", "national": nat_v, "regions": round(tot, 2), "ok": bool(ok)})
    manifest["nationalSeries"] = nat
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"done in {time.time()-t0:.0f}s; tables: {list(manifest['tables'])}; checks: {[c['ok'] for c in manifest['checks']]}", file=sys.stderr)
