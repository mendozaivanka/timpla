// Node version of geocode_gaps.py (this Mac's Python lacks SSL certificates).
// Fills missing lat/lon in editorial_list.psv from addresses via Nominatim: 1 req/s, cached, NCR-bounded.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "editorial_list.psv");
const CACHE = path.join(HERE, "geocache_specialty.json");
const UA = "cats-ive-met-cafes/0.1 (personal data-viz project; static site build)";
const BBOX = [120.90, 14.35, 121.15, 14.80];
const ONLY_INCLUDED = process.argv.includes("--included-only");
const includedNames = ONLY_INCLUDED
  ? new Set(readFileSync(path.join(HERE, "cafes.csv"), "utf8").split("\n").slice(1).filter((l) => /,yes,/.test(l)).map((l) => l.split(",")[0].replace(/^"|"$/g, "")))
  : null;

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function query(q) {
  if (q in cache) return cache[q];
  const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({ q, format: "jsonv2", limit: "1", countrycodes: "ph", viewbox: BBOX.join(","), bounded: "1" });
  let res = null;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    const hits = r.ok ? await r.json() : [];
    if (hits[0]) res = { lat: +hits[0].lat, lon: +hits[0].lon, display: hits[0].display_name };
  } catch (e) { console.log("    !", e.message); }
  await sleep(1100);
  cache[q] = res;
  writeFileSync(CACHE, JSON.stringify(cache, null, 1));
  return res;
}

const lines = readFileSync(SRC, "utf8").split("\n");
const hdr = lines[0].split("|").map((h) => h.trim().toLowerCase());
const ix = Object.fromEntries(hdr.map((h, i) => [h, i]));
let tried = 0, filled = 0, rejected = 0;
const out = [lines[0]];
for (const line of lines.slice(1)) {
  if (!line.trim()) { out.push(line); continue; }
  const p = line.split("|"); while (p.length < hdr.length) p.push("");
  const name = p[ix.name].trim();
  if ((p[ix.lat].trim() && p[ix.lon].trim()) || (includedNames && !includedNames.has(name))) { out.push(p.join("|")); continue; }
  const addr = p[ix.address].trim(), city = p[ix.city].trim(), hood = p[ix.neighbourhood].trim();
  const cands = [addr && `${addr}, ${city}`, hood && `${name}, ${hood}, ${city}`, city && `${name}, ${city}`].filter(Boolean);
  if (!cands.length) { out.push(p.join("|")); continue; }
  tried++;
  let res = null;
  for (const q of cands) { console.log(`  ${name} → ${q}`); res = await query(q); if (res) break; }
  if (res) {
    if (res.lon >= BBOX[0] && res.lon <= BBOX[2] && res.lat >= BBOX[1] && res.lat <= BBOX[3]) {
      p[ix.lat] = res.lat.toFixed(6); p[ix.lon] = res.lon.toFixed(6); p[ix.coord_source] = "nominatim"; filled++;
      console.log(`    ✓ ${res.display.slice(0, 90)}`);
    } else { rejected++; console.log(`    rejected (outside NCR): ${res.display.slice(0, 80)}`); }
  } else console.log("    no hit");
  out.push(p.join("|"));
}
writeFileSync(SRC, out.join("\n"));
console.log(`geocode: tried ${tried}, filled ${filled}, rejected ${rejected}`);
