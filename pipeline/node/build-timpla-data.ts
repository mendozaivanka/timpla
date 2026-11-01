// Derives Timpla's site data from the cafe-data project.
// Run: pipeline/build.sh   (reads pipeline/cafes by default, or CAFE_DATA=/path; writes OUT_DIR)
//
// Writes the café read models to OUT_DIR (a data release folder):
//   shops.json       included shops, grouped by slug, with branches + evidence
//   points.json      one row per mapped branch (slim, for the maps)
//   ncr.json         simplified NCR outline as an SVG path in a 300×380 box, plus the projection
//   timeline.json    openings per year (included shops vs whole ecosystem) + events
//   provenance.json  share of Manila listings vs share of the Arabica harvest, by province
//   directory.json   independent + multi-branch cafés from cafe-data/directory.csv (specialty rows live in shops.json)
//   osm_layer.json   OSM cafés with no recent evidence: [lon, lat, name], drawn faintly as "status unverified"
//   meta.json        counts and build date
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.resolve(process.env.CAFE_DATA ?? path.join(ROOT, "cafes"));
const OUT = path.resolve(process.env.OUT_DIR ?? path.join(ROOT, "build", "dev", "timpla"));
mkdirSync(OUT, { recursive: true });

// ───────── Parsing ─────────
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [hdr, ...body] = rows;
  return body.map((r) => Object.fromEntries(hdr.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}
function parsePsv(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  const hdr = lines[0].split("|").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((l) => {
    const p = l.split("|");
    return Object.fromEntries(hdr.map((h, i) => [h, (p[i] ?? "").trim()]));
  });
}
const read = (rel: string, enc: BufferEncoding = "utf8") => readFileSync(path.join(DATA, rel), enc);

export const slug = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cafe";
const TIER_RANK = { acclaimed: 0, recognised: 1, indie: 2 } as const;
type Tier = keyof typeof TIER_RANK;

// ───────── Shops & branches ─────────
const rows = parseCsv(read("cafes.csv")).filter((r) => r.included === "yes");
type Source = { outlet: string; url: string };
// Research codes look like "spot_100" or "philstar_ys"; readers should see the outlet's real name.
const OUTLETS: Record<string, string> = {
  spot: "Spot.ph", tatler: "Tatler", thebeat: "The Beat", tripzilla: "TripZilla", hypebae: "Hypebae", gma: "GMA",
  wcm: "World Coffee Map", worldcoffeemap: "World Coffee Map", philstar: "Philstar", philstarlife: "Philstar Life",
  baristamag: "Barista Magazine", ohm: "Over Here Manila", fltr: "FLTR", rappler: "Rappler", nolisoli: "Nolisoli",
  lifestyleasia: "Lifestyle Asia", thepost: "The Post", sprudge: "Sprudge", inquirer: "Inquirer", mb: "Manila Bulletin",
  esquire: "Esquire", says: "SAYS", grid: "GRID", mega: "Mega", abs: "ABS-CBN", abscbn: "ABS-CBN", smartlocal: "TheSmartLocal",
  thesmartlocal: "TheSmartLocal", booky: "Booky", klook: "Klook", interaksyon: "Interaksyon", tribune: "Tribune",
  topgear: "Top Gear", garage: "Garage", lasallian: "The LaSallian", lalamove: "Lalamove", preview: "Preview",
  clickthecity: "ClickTheCity", wheninmanila: "WhenInManila", spotph: "Spot.ph",
  delish: "Delish", worldcoffeeportal: "World Coffee Portal", overheremanila: "Over Here Manila", context: "Context",
};
const outletName = (code: string, url: string) => {
  const key = code.toLowerCase().split(/[_\-\d]/)[0];
  if (OUTLETS[key]) return OUTLETS[key];
  const host = url.match(/https?:\/\/(?:www\.|old\.)?([^/]+)/)?.[1] ?? "";
  const hostKey = host.split(".")[0].toLowerCase();
  return OUTLETS[hostKey] ?? (host || "Source");
};
const parseSources = (s: string): Source[] =>
  s.split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.indexOf(":");
    const code = i > 0 && !x.slice(0, i).includes("/") ? x.slice(0, i) : "";
    const url = code ? x.slice(i + 1).trim() : x;
    return { outlet: outletName(code, url), url };
  }).filter((s) => /^https?:\/\//.test(s.url));

const shops = new Map<string, any>();
for (const r of rows) {
  const id = slug(r.name);
  const shop = shops.get(id) ?? {
    slug: id, name: r.name, tier: r.tier as Tier, type: r.type, ownership: r.ownership,
    beans: "", since: "", endorsements: 0, sources: [] as Source[], signals: [] as string[],
    specialty: "", status: "", website: "", instagram: "", branches: [] as any[],
  };
  if (TIER_RANK[r.tier as Tier] < TIER_RANK[shop.tier as Tier]) shop.tier = r.tier;
  shop.beans ||= r.roaster_or_beans;
  shop.since ||= r.first_opened_year;
  shop.endorsements = Math.max(shop.endorsements, Number(r.endorsements) || 0);
  for (const s of parseSources(r.endorsement_sources)) if (!shop.sources.some((x: Source) => x.url === s.url)) shop.sources.push(s);
  for (const s of r.community_signals.split(";").map((x) => x.trim()).filter(Boolean)) if (!shop.signals.includes(s)) shop.signals.push(s);
  shop.specialty ||= r.specialty_evidence;
  shop.status ||= r.status_evidence;
  shop.website ||= r.website;
  shop.instagram ||= r.instagram;
  shop.branches.push({
    name: r.branch, neighbourhood: r.neighbourhood, city: r.city, address: r.address,
    lat: r.lat ? Number(Number(r.lat).toFixed(5)) : null, lon: r.lon ? Number(Number(r.lon).toFixed(5)) : null,
    coordSource: r.coord_source,
  });
  shops.set(id, shop);
}
const shopList = [...shops.values()].sort(
  (a, b) => TIER_RANK[a.tier as Tier] - TIER_RANK[b.tier as Tier] || b.endorsements - a.endorsements || a.name.localeCompare(b.name),
);

// ───────── Projection for the static maps (same box as the design mockups) ─────────
const BOX = { lon0: 120.92, lon1: 121.13, lat0: 14.36, lat1: 14.78, w: 300, h: 380 };
const project = (lon: number, lat: number) => [
  Number(((lon - BOX.lon0) / (BOX.lon1 - BOX.lon0) * BOX.w).toFixed(1)),
  Number(((BOX.lat1 - lat) / (BOX.lat1 - BOX.lat0) * BOX.h).toFixed(1)),
];

const points = shopList.flatMap((s) =>
  s.branches.filter((b: any) => b.lat != null).map((b: any) => ({
    slug: s.slug, name: s.name, branch: b.name, tier: s.tier, city: b.city, nb: b.neighbourhood,
    type: s.type, own: s.ownership === "foreign brand" ? "foreign" : "local",
    beans: (s.beans.split(/[;(]/)[0] || "").trim().slice(0, 48), since: s.since,
    lon: b.lon, lat: b.lat, xy: project(b.lon, b.lat),
  })),
);

const gj = JSON.parse(read("data/ncr_adm3.geojson"));
const ncrPath = gj.features.map((f: any) => {
  const polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
  const ring = polys.reduce((a: any, p: any) => (p[0].length > a.length ? p[0] : a), [] as number[][]);
  const step = Math.max(1, Math.floor(ring.length / 40));
  return "M" + ring.filter((_: any, i: number) => i % step === 0).map((c: number[]) => project(c[0], c[1]).map(Math.round).join(" ")).join("L") + "Z";
}).join("");

// ───────── Timeline ─────────
const tl = parsePsv(read("data/timeline.psv"));
const included = new Set(shopList.map((s) => slug(s.name)));
const years: { year: number; opened: number; openedIncluded: number; closed: number }[] = [];
for (let y = 2012; y <= 2026; y++) years.push({ year: y, opened: 0, openedIncluded: 0, closed: 0 });
for (const e of tl) {
  const y = years.find((x) => x.year === Number(e.year));
  if (!y) continue;
  if (e.event === "opened") { y.opened++; if (included.has(slug(e.name))) y.openedIncluded++; }
  if (e.event === "closed") y.closed++;
}

// ───────── Provenance: Manila listings vs Arabica harvest ─────────
const origins = parsePsv(read("data/origins.psv")).filter((o) => o.country === "Philippines" && o.province && o.province !== "UNRESOLVED");
const listingCounts = new Map<string, number>();
for (const o of origins) listingCounts.set(o.province, (listingCounts.get(o.province) ?? 0) + 1);
const psa = parseCsv(read("extra/psa_coffee_green_beans_by_province_2022_2025.csv", "latin1"));
const arabica = psa.filter((r) => r.Crop.startsWith("Coffee Arabica"));
const allCoffee = psa.filter((r) => r.Crop === "Coffee (green coffee beans)");
const val = (set: typeof psa, geo: string) => Number(set.find((r) => r.Geolocation.replace(/^\.+/, "") === geo)?.["2025 Annual"] ?? 0);
const arabicaTotal = val(arabica, "PHILIPPINES");
const allTotal = val(allCoffee, "PHILIPPINES");
const listingTotal = origins.length;
const provinces = ["Benguet", "Bukidnon", "Davao del Sur", "Mountain Province", "Sultan Kudarat"].map((p) => ({
  province: p,
  listings: listingCounts.get(p) ?? 0,
  menuShare: Number((((listingCounts.get(p) ?? 0) / listingTotal) * 100).toFixed(1)),
  arabicaTonnes: val(arabica, p),
  harvestShare: Number(((val(arabica, p) / arabicaTotal) * 100).toFixed(1)),
  allCoffeeShare: Number(((val(allCoffee, p) / allTotal) * 100).toFixed(1)),
}));

// ───────── Directory: everything independent with recent evidence (scripts/build_directory.py) ─────────
const dir = parseCsv(read("directory.csv"));
const round5 = (x: string) => Number(Number(x).toFixed(5));
const others = dir.filter((r) => r.cls !== "specialty").map((r) => ({
  id: r.osm_id, name: r.name, cls: r.cls as "independent" | "multibranch", city: r.city,
  lon: round5(r.lon), lat: round5(r.lat), n: Number(r.locations) || 1,
  ev: r.open_evidence, evd: r.evidence_date, ig: r.instagram.replace(/^@/, ""), web: r.website,
}));
const layer = (JSON.parse(read("osm_layer.json")) as { name: string; lon: number; lat: number }[])
  .map((c) => [Number(c.lon.toFixed(5)), Number(c.lat.toFixed(5)), c.name]);
const count = <T,>(xs: T[], f: (x: T) => string) => xs.reduce((a, x) => ({ ...a, [f(x)]: (a[f(x)] ?? 0) + 1 }), {} as Record<string, number>);

// ───────── Write ─────────
const meta = {
  builtAt: new Date().toISOString().slice(0, 10),
  shops: shopList.length,
  branches: rows.length,
  mapped: points.length,
  tiers: Object.fromEntries((["acclaimed", "recognised", "indie"] as Tier[]).map((t) => [t, shopList.filter((s) => s.tier === t).length])),
  roasterLinks: parsePsv(read("data/roaster_edges.psv")).length,
  beanListings: parsePsv(read("data/origins.psv")).length,
  listingTotal, arabicaTotal, allTotal,
  directory: {
    shops: shopList.length + others.length,
    branches: rows.length + others.length,
    classes: { specialty: rows.length, ...count(others, (o) => o.cls) },
    evidence: { editorial_2025_26: rows.length, ...count(others, (o) => o.ev) },
    unverified: layer.length,
  },
};
const write = (name: string, data: unknown) => writeFileSync(path.join(OUT, name), JSON.stringify(data) + "\n");
write("shops.json", shopList);
write("points.json", points);
write("ncr.json", { path: ncrPath, box: BOX });
write("timeline.json", { years, events: tl.length });
write("provenance.json", provinces);
write("directory.json", others);
write("osm_layer.json", layer);
write("meta.json", meta);
console.log(`timpla: ${meta.shops} specialty shops, ${meta.branches} branches, ${meta.mapped} mapped → ${path.relative(process.cwd(), OUT)}/`);
console.log(`  directory: ${meta.directory.shops} shops, ${meta.directory.branches} branches`, meta.directory.classes, `· ${layer.length} unverified`);
console.log("  provenance:", provinces.map((p) => `${p.province} menu ${p.menuShare}% vs arabica ${p.harvestShare}%`).join("; "));
