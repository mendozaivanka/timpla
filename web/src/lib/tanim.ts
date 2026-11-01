/**
 * Tanim helpers: units, bins, plain-language sentences (Filipino first, then English) and small formatters.
 * Data comes from the data layer (getTanimProvinces etc. in @/lib/data); this file holds no data.
 */
export type Variety = "all" | "robusta" | "arabica" | "excelsa" | "liberica";
export type Measure = "production" | "area" | "trees" | "yield" | "farmgate" | "cpi";
export type YearMap = Record<string, number | null>;
export type VarietySeries = Record<Variety, YearMap>;

export const VARIETIES: { id: Variety; label: string }[] = [
  { id: "all", label: "all" }, { id: "robusta", label: "Robusta" }, { id: "arabica", label: "Arabica" }, { id: "excelsa", label: "Excelsa" }, { id: "liberica", label: "Liberica" },
];
export const MEASURES: { id: Measure; label: string; unit: string; short: string }[] = [
  { id: "production", label: "tonnes", unit: "tonnes of green coffee", short: "t" },
  { id: "area", label: "hectares", unit: "hectares planted", short: "ha" },
  { id: "trees", label: "bearing trees", unit: "bearing trees", short: "trees" },
  { id: "yield", label: "t per ha", unit: "tonnes per hectare (production ÷ area)", short: "t/ha" },
  { id: "farmgate", label: "farmgate ₱/kg", unit: "pesos per kilo, farmgate, yearly average", short: "₱/kg" },
  { id: "cpi", label: "coffee CPI", unit: "coffee CPI, 2018 = 100", short: "" },
];
export const FORMS: Record<string, string> = { green: "Green beans", roasted: "Roasted", extracts: "Extracts (for instant)", other: "Other" };

/** Fixed class breaks for tonnes, hectares and trees (the same in every year, map, legend and table). */
export const BINS: Record<string, number[]> = {
  production: [50, 200, 1000, 5000],
  area: [100, 500, 2000, 10000],
  trees: [50_000, 250_000, 1_000_000, 5_000_000],
  yield: [0.2, 0.4, 0.6, 0.8],
  farmgate: [100, 150, 200, 250],
  cpi: [105, 115, 125, 135],
};
export const BIN_LABELS = (m: Measure) => {
  const b = BINS[m]; const f = (v: number) => (m === "yield" ? v.toFixed(1) : v.toLocaleString("en"));
  return ["none", `under ${f(b[0])}`, `${f(b[0])}–${f(b[1])}`, `${f(b[1])}–${f(b[2])}`, `${f(b[2])}–${f(b[3])}`, `${f(b[3])}+`];
};
/** 0 = none/no data, 1..5 = the five steps of the sequential ramp. */
export function binOf(m: Measure, v: number | null | undefined): number {
  if (v == null || v <= 0) return 0;
  const b = BINS[m]; let i = 1; for (const t of b) if (v >= t) i++; return i;
}

export function valueOf(p: { production: VarietySeries; area: VarietySeries; trees: VarietySeries; farmgate: VarietySeries; cpi: Record<string, number> }, m: Measure, v: Variety, year: string): number | null {
  if (m === "cpi") return p.cpi[year] ?? null;
  if (m === "yield") { const t = p.production[v][year], a = p.area[v][year]; return t != null && a ? t / a : null; }
  return p[m][v][year] ?? null;
}

export const fmt = (v: number | null | undefined, digits = 0) => (v == null ? "…" : v.toLocaleString("en", { maximumFractionDigits: digits, minimumFractionDigits: digits }));

/** A share as the nearest saying people use. */
export function saying(share: number, lang: "en" | "fil"): string {
  const en: [number, string][] = [[0.5, "half"], [0.33, "a third"], [0.25, "a quarter"], [0.2, "a fifth"], [0.1, "a tenth"]];
  const fil: [number, string][] = [[0.5, "kalahati"], [0.33, "sangkatlo"], [0.25, "sangkapat"], [0.2, "ikalima"], [0.1, "ikasampu"]];
  for (const [f, w] of lang === "en" ? en : fil) if (Math.abs(share - f) <= 0.02) return w;
  const n = Math.round(share * 100);
  return lang === "en" ? `${n} in every 100 tonnes` : `${n} sa bawat 100 tonelada`;
}

export function provinceSentences(name: string, year: string, t: number, national: number, prev: number | null): { fil: string; en: string } {
  const share = t / national; const s = saying(share, "en"), sf = saying(share, "fil");
  const change = prev && prev > 0 ? (t / prev - 1) * 100 : null;
  const en = `${name} grew ${fmt(t)} tonnes of green coffee in ${year}, ${s} of what the country reported` + (change == null ? "." : `, and ${Math.abs(change).toFixed(0)} % ${change >= 0 ? "more" : "less"} than in ${Number(year) - 1}.`);
  const fil = `Nag-ani ang ${name} ng ${fmt(t)} tonelada ng berdeng kape noong ${year}, ${sf} ng buong bansa` + (change == null ? "." : `, at ${Math.abs(change).toFixed(0)} % na ${change >= 0 ? "mas marami" : "mas kaunti"} kaysa ${Number(year) - 1}.`);
  return { fil, en };
}

export const last = (m: YearMap): [string, number] | null => {
  const ys = Object.keys(m).filter((y) => m[y] != null).sort(); const y = ys[ys.length - 1]; return y ? [y, m[y] as number] : null;
};
export const at = (m: YearMap, y: string) => m[y] ?? null;
