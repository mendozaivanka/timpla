"""Render cafes.csv / cafes.geojson + the PSV side-tables into one self-contained HTML report
(map, city bars, roaster network table, timeline, bean prices). Opens offline except for map tiles."""
import csv, json, os
from collections import Counter, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
HERE = ROOT
def load_csv(name, delim=","):
    p = os.path.join(ROOT, name) if os.path.exists(os.path.join(ROOT, name)) else os.path.join(ROOT, "data", name)
    return list(csv.DictReader(open(p, encoding="utf-8"), delimiter=delim)) if os.path.exists(p) else []

cafes = load_csv("cafes.csv")
inc = [r for r in cafes if r["included"] == "yes"]
geo = json.load(open(os.path.join(HERE, "cafes.geojson")))
edges = load_csv("roaster_edges.psv", "|")
origins = load_csv("origins.psv", "|")
timeline = load_csv("timeline.psv", "|")
awards = load_csv("awards_events.psv", "|")
beans = load_csv("bean_prices_per250g.csv")
qa = open(os.path.join(HERE, "qa_report.md"), encoding="utf-8").read() if os.path.exists(os.path.join(HERE, "qa_report.md")) else ""

shops = sorted({r["name"] for r in inc})
_best = {}
for _t in ("indie", "recognised", "acclaimed"):
    for _r in inc:
        if _r.get("tier") == _t: _best[_r["name"]] = _t
tier_bars = [(t, sum(1 for v in _best.values() if v == t)) for t in ("acclaimed", "recognised", "indie")]
by_city = Counter(r["city"] for r in inc).most_common()
# Timeline charts count only shops that pass the inclusion rules (the timeline file also tracks borderline names)
import re as _re, unicodedata as _ud
def _norm(s):
    s = _ud.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = _re.sub(r"[’'`.]", "", s)
    s = _re.sub(r"\b(the|cafe|café|coffee|roasters?|roastery|co|ph|and|bar|bakery|kitchen|haus|house)\b", " ", s)
    return _re.sub(r"[^a-z0-9]+", " ", s).strip()
included_keys = {_norm(n) for n in shops}
tl_inc = [r for r in timeline if _norm(r.get("name", "")) in included_keys]
by_year = Counter(r["year"] for r in tl_inc if r.get("event") == "opened" and r.get("year", "").isdigit())
closed_by_year = Counter(r["year"] for r in tl_inc if r.get("event") == "closed" and r.get("year", "").isdigit())
years = sorted(set(by_year) | set(closed_by_year))
roaster_deg = Counter(e["roaster"] for e in edges
                      if e.get("relation", "serves") in ("serves", "roasted_by", "wholesale_stockist") and e.get("roaster", "").upper() != "UNVERIFIED")
PH_PROVINCES = {"Benguet", "Mountain Province", "Kalinga", "Ifugao", "Bukidnon", "Davao del Sur", "Davao", "Sultan Kudarat", "South Cotabato",
                "Cavite", "Batangas", "Sagada", "Cotabato", "Misamis Oriental", "Negros", "Quezon", "Nueva Vizcaya", "Apayao", "Abra", "Laguna"}
def province_of(r):
    p = r.get("province") or r.get("province_or_country") or ""
    return p if (r.get("country", "").lower() in ("philippines", "ph", "") and any(p.startswith(x) for x in PH_PROVINCES)) else None
prov = Counter(p for p in (province_of(r) for r in origins) if p)
bean_med = defaultdict(list)
for b in beans:
    try: bean_med[b["origin_class"]].append(float(b["php_per_250g"]))
    except Exception: pass
def median(xs):
    xs = sorted(xs); n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2 if n else None

def esc(s): return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
def table(rows, cols, limit=None):
    rows = rows[:limit] if limit else rows
    h = "".join(f"<th>{esc(c)}</th>" for c in cols)
    b = "".join("<tr>" + "".join(f"<td>{esc(r.get(c, ''))}</td>" for c in cols) + "</tr>" for r in rows)
    return f"<table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>"
def bars(pairs, unit=""):
    if not pairs: return "<p class='muted'>no data</p>"
    mx = max(v for _, v in pairs) or 1
    return "<div class='bars'>" + "".join(
        f"<div class='bar'><span class='lbl'>{esc(k)}</span><i style='width:{v / mx * 100:.1f}%'></i><b>{v}{unit}</b></div>" for k, v in pairs) + "</div>"

html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Metro Manila specialty cafés: dataset report</title>
<link href="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css" rel="stylesheet">
<script src="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js"></script>
<style>
:root{{--bg:#fbf6f7;--fg:#2e1d24;--muted:#7a6169;--card:#fff;--line:#eedde2;--pink:#f4b3c6;--rose:#b04a6f;--gold:#f6d49e}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}}
main{{max-width:1040px;margin:0 auto;padding:32px 16px 64px}}h1{{font-size:clamp(28px,5vw,40px);margin:0 0 4px}}h2{{font-size:22px;margin:40px 0 12px}}
.muted{{color:var(--muted)}}.kpis{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:20px 0}}
.kpi{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}}.kpi b{{display:block;font-size:30px;line-height:1.1}}
#map{{height:520px;border-radius:16px;border:1px solid var(--line);overflow:hidden}}
table{{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:13px}}
th,td{{padding:8px 10px;text-align:left;border-top:1px solid var(--line);vertical-align:top}}th{{background:#f8e9ee;border-top:0;font-weight:600}}
.bars{{display:grid;gap:6px}}.bar{{display:grid;grid-template-columns:150px 1fr 44px;align-items:center;gap:8px;font-size:13px}}
.bar i{{display:block;height:14px;border-radius:7px;background:linear-gradient(90deg,var(--pink),var(--rose))}}.bar b{{text-align:right;font-variant-numeric:tabular-nums}}
.pin{{width:14px;height:14px;border-radius:50%;background:var(--rose);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer}}
.pin.acclaimed{{background:var(--rose)}}.pin.recognised{{background:#e889a4}}.pin.indie{{background:#9fd3b5;border-color:#3a7d5c}}.maplibregl-popup-content{{font:13px/1.4 system-ui;border-radius:10px}}
pre{{white-space:pre-wrap;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:12px}}
.legend{{font-size:13px;margin:8px 0}}.legend i{{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:middle;margin:0 4px 0 10px}}
</style></head><body><main>
<p class="muted" style="margin:0">Dataset report · built {__import__('datetime').date.today().isoformat()}</p>
<h1>Metro Manila specialty cafés</h1>
<p class="muted">Inside NCR · specialty · open in 2026. Recognition is shown as a tier, so indie and lesser-known cafés are included. Ratings from Google/Foursquare are not used because their terms forbid storing them.</p>
<div class="kpis">
 <div class="kpi"><b>{len(shops)}</b>shops</div><div class="kpi"><b>{len(inc)}</b>branches</div>
 <div class="kpi"><b>{len(geo['features'])}</b>mapped</div><div class="kpi"><b>{len(edges)}</b>roaster links</div>
 <div class="kpi"><b>{len(origins)}</b>bean listings</div><div class="kpi"><b>{len(timeline)}</b>timeline events</div>
</div>
<h2>Map</h2><div class="legend">Pins: <i style="background:var(--rose)"></i>acclaimed (2+ write-ups or awards) <i style="background:#e889a4"></i>recognised (1 write-up, pedigree or community) <i style="background:#9fd3b5;border:1px solid #3a7d5c"></i>indie (specialty, no press yet)</div>
<div id="map"></div>
<h2>Branches by city</h2>{bars(by_city)}
<h2>Openings and closures by year</h2>{bars([(y, by_year.get(y, 0)) for y in years])}
<p class="muted">Closures recorded: {", ".join(f"{y}: {n}" for y, n in sorted(closed_by_year.items())) or "none found"}</p>
<h2>Most-connected roasters</h2>{bars(roaster_deg.most_common(12), " cafés")}
<h2>Philippine bean origins named by roasters</h2>{bars(prov.most_common(12), " listings")}
<p class="muted">Median price per 250 g: {", ".join(f"{k} ₱{median(v):,.0f} (n={len(v)})" for k, v in bean_med.items() if v)}</p>
<h2>Awards and events</h2>{table(awards, ["kind", "year", "name", "rank_or_role", "affiliation", "province_or_city"], 40)}
<h2>Shops by tier</h2>{bars(tier_bars)}
<h2>All included branches</h2>{table(sorted(inc, key=lambda r: ({"acclaimed":0,"recognised":1,"indie":2}.get(r["tier"],3), r["name"])), ["name", "branch", "tier", "city", "neighbourhood", "type", "roaster_or_beans", "endorsements", "first_opened_year"])}
<h2>QA report</h2><pre>{esc(qa)}</pre>
</main>
<script>
const data = {json.dumps(geo)};
const map = new maplibregl.Map({{container:'map', style:'https://tiles.openfreemap.org/styles/positron', center:[121.03,14.56], zoom:11.2, attributionControl:{{compact:true}}}});
map.addControl(new maplibregl.NavigationControl({{showCompass:false}}),'bottom-right');
const b = new maplibregl.LngLatBounds();
for (const f of data.features) {{
  const p = f.properties, el = document.createElement('div');
  el.className = 'pin ' + (p.tier || 'indie');
  const html = `<b>${{p.name}}</b>${{p.branch ? ' · ' + p.branch : ''}}<br>${{p.neighbourhood||''}} ${{p.city||''}}<br><span style="color:#7a6169">${{p.roaster_or_beans||''}}</span><br>${{p.tier}} · write-ups: ${{p.endorsements}} · since ${{p.first_opened_year||'?'}}`;
  new maplibregl.Marker({{element:el}}).setLngLat(f.geometry.coordinates).setPopup(new maplibregl.Popup({{offset:10}}).setHTML(html)).addTo(map);
  b.extend(f.geometry.coordinates);
}}
if (data.features.length) map.fitBounds(b, {{padding:40, maxZoom:14}});
</script></body></html>"""
out = os.path.join(HERE, "report.html")
open(out, "w", encoding="utf-8").write(html)
print("wrote", out, len(html) // 1024, "KB;", len(inc), "included branches,", len(geo["features"]), "mapped")
