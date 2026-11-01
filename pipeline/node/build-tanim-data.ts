// Derives Tanim's site data from ../tanim-data (raw PSA pulls + boundaries + the reported-facts list).
// Run: pipeline/build.sh   (reads pipeline/beans by default, or TANIM_DATA=/path; writes OUT_DIR)
//
// Writes the Beans and Shipped-in read models to OUT_DIR (a data release folder):
//   provinces.json   one row per province: PSGC, region, SVG path (300×515 box), per-variety series by year
//   national.json    country rows: production/area/trees by variety, SUA, SSR, IDR, value of production, CPI, FIES
//   imports.json     per year: origin × product form (kg, USD) plus a precomputed Sankey layout
//   reported.json    hand-compiled facts with their links (kind 2)
//   meta.json        table ids and PSA "updated" stamps, retrieval date, checks, counts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.resolve(process.env.TANIM_DATA ?? path.join(ROOT, "beans"));
const OUT = path.resolve(process.env.OUT_DIR ?? path.join(ROOT, "build", "dev", "tanim"));
mkdirSync(OUT, { recursive: true });
const readJson = (rel: string) => JSON.parse(readFileSync(path.join(DATA, rel), "utf8"));

type Series = Record<string, Record<string, Record<string, number | null>>>; // geo label -> variety -> year -> value
const production: Series = readJson("raw/production.json");
const area: Series = readJson("raw/area.json");
const trees: Series = readJson("raw/trees.json");
const farmgate: Series = readJson("raw/farmgate.json");
const cpi: Record<string, Record<string, number>> = readJson("raw/cpi.json");
const fies: Record<string, Record<string, number>> = readJson("raw/fies.json");
const importsRaw: Record<string, { line: string; form: string; country: string; countryName: string; measure: "kg" | "usd"; value: number }[]> = readJson("raw/imports.json");
const manifest = readJson("data/manifest.json");
const geo = readJson("raw/provdists.geojson") as { features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[] };

const VARIETIES = ["all", "robusta", "arabica", "excelsa", "liberica"] as const;
const clean = (s: string) => s.replace(/^\.+/, "").replace(/\s+[a-z0-9]\/$/, "").trim();
const isProvince = (label: string) => label.startsWith("....");
const isRegion = (label: string) => label.startsWith("..") && !label.startsWith("....");

// ───────── Crosswalk: PSA labels → the boundary file's names ─────────
// PSA's label is the key everywhere; a province row in the boundary file is matched by name with these aliases.
const ALIAS: Record<string, string> = {
  "Compostela Valley": "Davao de Oro", "Samar (Western Samar)": "Samar", "Cotabato (North Cotabato)": "Cotabato",
  "Isabela City": "City of Isabela (Not a Province)", "Tawi-tawi": "Tawi-Tawi", "Maguindanao": "Maguindanao del Sur",
};
// Cities PSA reports separately that the boundary file folds into a province (PLAN-v3 rule 5)
const MERGE_INTO: Record<string, string> = { "City of Davao": "Davao del Sur", "City of Zamboanga": "Zamboanga del Sur", "City of Bacolod": "Negros Occidental", "City of Puerto Princesa": "Palawan", "City of Butuan": "Agusan del Norte" };

// ───────── Boundaries → SVG paths in a 300×515 box (equirectangular, cos(lat) corrected) ─────────
const LON0 = 116.9, LON1 = 126.65, LAT0 = 4.55, LAT1 = 21.15, W = 300;
const K = Math.cos((((LAT0 + LAT1) / 2) * Math.PI) / 180);
const H = Math.round((W * (LAT1 - LAT0)) / ((LON1 - LON0) * K) * 10) / 10;
const px = (lon: number, lat: number): [number, number] => [Math.round(((lon - LON0) / (LON1 - LON0)) * W), Math.round(((LAT1 - lat) / (LAT1 - LAT0)) * H)];
function pathOf(geometry: { type: string; coordinates: unknown }): { d: string; cx: number; cy: number } {
  const polys = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as number[][][][];
  const parts: string[] = []; let big: [number, number][] = []; let bigA = 0;
  for (const poly of polys) for (const ring of poly) {
    const pts = ring.map(([lon, lat]) => px(lon, lat));
    let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; }
    a = Math.abs(a) / 2; if (a < 1.5) continue;
    const dd: [number, number][] = []; for (const p of pts) if (!dd.length || dd[dd.length - 1][0] !== p[0] || dd[dd.length - 1][1] !== p[1]) dd.push(p);
    if (dd.length < 4) continue;
    parts.push("M" + dd.map(([x, y]) => `${x} ${y}`).join("L") + "Z");
    if (a > bigA) { bigA = a; big = dd; }
  }
  const cx = Math.round(big.reduce((s, p) => s + p[0], 0) / (big.length || 1)), cy = Math.round(big.reduce((s, p) => s + p[1], 0) / (big.length || 1));
  return { d: parts.join(""), cx, cy };
}
const shapes = new Map<string, { psgc: number; regionPsgc: number; d: string; cx: number; cy: number }>();
for (const f of geo.features) {
  const p = f.properties; const name = String(p.adm2_en ?? p.adm1_en ?? p.adm2_psgc);
  shapes.set(name, { psgc: Number(p.adm2_psgc), regionPsgc: Number(p.adm1_psgc), ...pathOf(f.geometry) });
}

// ───────── Provinces ─────────
// PSA labels carry an indent (".... province", "...... city") and sometimes a footnote twin ("Sulu" and "Sulu c/"), so
// rows are gathered by cleaned name first; a twin's non-null values fill the other's gaps.
const years = Object.keys(production.PHILIPPINES?.all ?? {}).sort();
type Row = Record<string, Record<string, number | null>>;
function gather(src: Series, level: "province" | "city"): Map<string, { row: Row; region: string }> {
  const out = new Map<string, { row: Row; region: string }>(); let region = "";
  for (const label of Object.keys(src)) {
    if (isRegion(label)) { region = clean(label); continue; }
    const isCity = label.startsWith("......");
    if ((level === "city") !== isCity || !label.startsWith("....")) continue;
    const name = clean(label); const cur = out.get(name) ?? { row: Object.fromEntries(VARIETIES.map((v) => [v, {}])), region };
    for (const v of VARIETIES) for (const [y, val] of Object.entries(src[label][v] ?? {})) if (val != null || cur.row[v][y] == null) cur.row[v][y] = val ?? cur.row[v][y] ?? null;
    out.set(name, cur);
  }
  return out;
}
const P = { production: gather(production, "province"), area: gather(area, "province"), trees: gather(trees, "province"), farmgate: gather(farmgate, "province") };
const CITY = { production: gather(production, "city"), area: gather(area, "city"), trees: gather(trees, "city") };
const addInto = (target: Row, extra: Row | undefined) => { if (!extra) return; for (const v of VARIETIES) for (const [y, val] of Object.entries(extra[v] ?? {})) if (val != null) target[v][y] = (target[v][y] ?? 0) + val; };
const empty = (): Row => Object.fromEntries(VARIETIES.map((v) => [v, {}]));
const provinceRows: any[] = []; const unmatched: string[] = [];
for (const [name, { region }] of P.production) {
  if (MERGE_INTO[name]) continue;
  const shape = shapes.get(name) ?? shapes.get(ALIAS[name] ?? "") ?? [...shapes.entries()].find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
  if (!shape) { unmatched.push(name); continue; }
  const shapeName = [...shapes.entries()].find(([, v]) => v === shape)![0];
  const existing = provinceRows.find((r) => r.psgc === shape.psgc);
  const rows = { production: P.production.get(name)?.row ?? empty(), area: P.area.get(name)?.row ?? empty(), trees: P.trees.get(name)?.row ?? empty(), farmgate: P.farmgate.get(name)?.row ?? empty() };
  for (const [city, prov] of Object.entries(MERGE_INTO)) if (prov === shapeName || prov === name) { addInto(rows.production, CITY.production.get(city)?.row); addInto(rows.area, CITY.area.get(city)?.row); addInto(rows.trees, CITY.trees.get(city)?.row); }
  if (existing) { // an aliased old name landing on an existing polygon (Maguindanao → del Sur): fill gaps, note it
    for (const k of ["production", "area", "trees", "farmgate"] as const) for (const v of VARIETIES) for (const [y, val] of Object.entries(rows[k][v])) if (val != null && existing[k][v][y] == null) existing[k][v][y] = val;
    existing.note = `Before the 2022 split PSA reported Maguindanao as one province; those years are shown here.`;
    continue;
  }
  const norm = (k: string) => clean(k).replace(/\s*\(.*?\)\s*/g, " ").trim().toLowerCase();
  const same = (k: string) => norm(k) === shapeName.toLowerCase() || norm(k) === name.toLowerCase();
  const cpiRow = Object.entries(cpi).find(([k]) => same(k))?.[1] ?? {};
  const fiesRow = Object.entries(fies).find(([k]) => same(k))?.[1] ?? {};
  provinceRows.push({ psgc: shape.psgc, name: shapeName, region, d: shape.d, cx: shape.cx, cy: shape.cy, ...rows, cpi: cpiRow, fies: fiesRow, note: MERGE_INTO_NOTE(shapeName) });
}
function MERGE_INTO_NOTE(prov: string) { const cities = Object.entries(MERGE_INTO).filter(([, p]) => p === prov).map(([c]) => c); return cities.length ? `${cities.join(" and ")} counted with the province.` : undefined; }
if (unmatched.length) throw new Error(`tanim: PSA provinces with no boundary: ${unmatched.join(", ")} (add an alias in scripts/build-tanim-data.ts)`);
for (const [name, shape] of shapes) {
  if (provinceRows.some((r) => r.psgc === shape.psgc)) continue;
  provinceRows.push({ psgc: shape.psgc, name, region: "", d: shape.d, cx: shape.cx, cy: shape.cy, production: empty(), area: empty(), trees: empty(), farmgate: empty(), cpi: {}, fies: {}, note: undefined });
}
for (const r of provinceRows) if (r.note === undefined) delete r.note;

const seriesFor = (src: Series, label: string) => Object.fromEntries(VARIETIES.map((v) => [v, src[label]?.[v] ?? {}]));

// ───────── National and regions ─────────
const nat = manifest.nationalSeries;
const regions = Object.keys(production).filter(isRegion).map((label) => ({ name: clean(label), production: seriesFor(production, label), area: seriesFor(area, label), trees: seriesFor(trees, label) }));
const national = {
  years, production: seriesFor(production, "PHILIPPINES"), area: seriesFor(area, "PHILIPPINES"), trees: seriesFor(trees, "PHILIPPINES"), farmgate: seriesFor(farmgate, "PHILIPPINES"),
  sua: nat.sua.items, ssr: nat.ssr.years, idr: nat.idr.years, valueOfProduction: nat.valueOfProduction.millionPesos,
  cpi: cpi.PHILIPPINES ?? {}, fies: fies.PHILIPPINES ?? {}, regions,
};

// ───────── Imports: origin × form per year, plus a Sankey layout ─────────
// 3-in-1 preparations (HS 2101.12) are left out: they are mostly sugar and creamer, not coffee beans
const FORMS = ["green", "roasted", "extracts", "other"] as const;
const KEEP = new Set<string>(FORMS);
type Flow = { origin: string; name: string; form: string; kg: number; usd: number };
const SHORT: Record<string, string> = { "Republic Of Korea": "South Korea", "People's Republic Of China": "China", "Socialist Republic Of Vietnam": "Vietnam", "United States Of America": "United States", "Lao People's Democratic Republic": "Laos", "Hong Kong Sar": "Hong Kong", "Taiwan, Province Of China": "Taiwan", "United Kingdom Of Great Britain And Northern Ireland": "United Kingdom" };
const shortName = (n: string) => SHORT[n] ?? n.replace(/^(Republic Of|Kingdom Of|State Of|People's Republic Of|Federal Republic Of|Commonwealth Of) /i, "").replace(/ \(.*\)$/, "");
const importsOut: Record<string, { flows: Flow[]; byForm: Record<string, { kg: number; usd: number }>; sankey: unknown }> = {};
for (const [year, cells] of Object.entries(importsRaw)) {
  const acc = new Map<string, Flow>();
  for (const c of cells) {
    if (!KEEP.has(c.form)) continue;
    const key = `${c.country}|${c.form}`;
    const f = acc.get(key) ?? { origin: c.country, name: shortName(c.countryName), form: c.form, kg: 0, usd: 0 };
    f[c.measure] += c.value; acc.set(key, f);
  }
  const flows = [...acc.values()].filter((f) => f.usd > 0 || f.kg > 0);
  const byForm: Record<string, { kg: number; usd: number }> = {};
  for (const f of flows) { byForm[f.form] ??= { kg: 0, usd: 0 }; byForm[f.form].kg += f.kg; byForm[f.form].usd += f.usd; }
  importsOut[year] = { flows, byForm, sankey: sankey(flows, "usd") };
}
/** A small Sankey: top 8 origins + Other on the left, product forms on the right; positions in a 560×420 box. */
function sankey(flows: Flow[], unit: "kg" | "usd") {
  const byOrigin = new Map<string, number>();
  for (const f of flows) byOrigin.set(f.name, (byOrigin.get(f.name) ?? 0) + f[unit]);
  const top = [...byOrigin.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n);
  const nameOf = (n: string) => (top.includes(n) ? n : "Other");
  const links = new Map<string, number>();
  for (const f of flows) { if (f.form === "other") continue; const k = `${nameOf(f.name)}|${f.form}`; links.set(k, (links.get(k) ?? 0) + f[unit]); }
  const left = [...top, "Other"].filter((o) => [...links.keys()].some((k) => k.startsWith(o + "|")));
  const right = FORMS.filter((f) => f !== "other" && [...links.keys()].some((k) => k.endsWith("|" + f)));
  const total = [...links.values()].reduce((a, b) => a + b, 0) || 1;
  const WIDTH = 680, HEIGHT = 420, PAD = 10, NW = 10, x0 = 200, x1 = WIDTH - 210;
  const k = (HEIGHT - 20 - PAD * (left.length - 1)) / total;
  const ly: Record<string, [number, number]> = {}; let y = 10;
  for (const o of left) { const h = [...links].filter(([kk]) => kk.startsWith(o + "|")).reduce((s, [, v]) => s + v, 0) * k; ly[o] = [y, y + h]; y += h + PAD; }
  const ry: Record<string, [number, number]> = {}; y = 10 + (HEIGHT - 20 - total * k - PAD * (right.length - 1)) / 2;
  for (const f of right) { const h = [...links].filter(([kk]) => kk.endsWith("|" + f)).reduce((s, [, v]) => s + v, 0) * k; ry[f] = [y, y + h]; y += h + PAD; }
  const lcur = Object.fromEntries(left.map((o) => [o, ly[o][0]])), rcur = Object.fromEntries(right.map((f) => [f, ry[f][0]]));
  const paths: { origin: string; form: string; value: number; share: number; d: string; width: number }[] = [];
  for (const f of right) for (const o of left) {
    const v = links.get(`${o}|${f}`); if (!v) continue;
    const w = v * k, ya = lcur[o] + w / 2, yb = rcur[f] + w / 2; lcur[o] += w; rcur[f] += w;
    const xa = x0 + NW, xb = x1, cx = (xa + xb) / 2;
    paths.push({ origin: o, form: f, value: v, share: v / total, d: `M${xa} ${ya.toFixed(1)}C${cx} ${ya.toFixed(1)} ${cx} ${yb.toFixed(1)} ${xb} ${yb.toFixed(1)}`, width: Math.max(w, 1.2) });
  }
  return {
    width: WIDTH, height: HEIGHT, unit, total,
    origins: left.map((o) => ({ name: o, y0: ly[o][0], y1: ly[o][1], value: (ly[o][1] - ly[o][0]) / k, x: x0, w: NW })),
    forms: right.map((f) => ({ name: f, y0: ry[f][0], y1: ry[f][1], value: (ry[f][1] - ry[f][0]) / k, x: x1, w: NW })),
    links: paths,
  };
}

// ───────── Reported facts (kind 2) ─────────
const reportedPath = path.join(DATA, "data", "reported.csv");
const reported = existsSync(reportedPath)
  ? readFileSync(reportedPath, "utf8").trim().split("\n").slice(1).filter(Boolean).map((line) => { const [province, text, source, date, url] = line.split("|").map((s) => s.trim()); return { province, text, source, date, url }; })
  : [];

// ───────── Write ─────────
const write = (name: string, data: unknown) => writeFileSync(path.join(OUT, name), JSON.stringify(data) + "\n");
// The latest year with an annual national figure (the current year only has quarters until PSA closes it)
const latest = [...years].reverse().find((y) => (production.PHILIPPINES?.all?.[y] ?? null) != null) ?? years[years.length - 1];
const reporting = provinceRows.filter((r: any) => r.production.all?.[latest] > 0).length;
write("provinces.json", provinceRows);
write("national.json", national);
write("imports.json", importsOut);
write("reported.json", reported);
write("meta.json", {
  builtAt: new Date().toISOString().slice(0, 10), retrievedAt: manifest.retrievedAt, tables: manifest.tables, checks: manifest.checks, boundaries: manifest.boundaries,
  years, latestYear: latest, provinces: provinceRows.length, reporting, importYears: Object.keys(importsOut).sort(),
  box: { w: W, h: H },
});
console.log(`tanim: ${provinceRows.length} provinces (${reporting} reporting coffee in ${latest}), ${Object.keys(importsOut).length} import years → ${path.relative(process.cwd(), OUT)}/`);
