import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { BIN_LABELS, MEASURES, VARIETIES, binOf, fmt, provinceSentences, saying, valueOf, type Measure, type Variety, type VarietySeries } from "@/lib/tanim";

export type AtlasProvince = { psgc: number; name: string; region: string; d: string; cx: number; cy: number; note?: string; production: VarietySeries; area: VarietySeries; trees: VarietySeries; farmgate: VarietySeries; cpi: Record<string, number>; fies: Record<string, number> };
export type AtlasData = { years: string[]; latest: string; box: { w: number; h: number }; national: { production: VarietySeries; cpi: Record<string, number>; fies: Record<string, number> }; provinces: AtlasProvince[]; reported: { province: string; text: string; source: string; date: string; url: string }[] };

const RAMP = ["var(--rosas-1)", "var(--rosas-2)", "var(--rosas-3)", "var(--rosas-4)", "var(--rosas-5)", "var(--tier-acclaimed)"];

function Chips<T extends string>({ label, items, value, onChange }: { label: string; items: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <button key={t.id} type="button" aria-pressed={value === t.id} onClick={() => onChange(t.id)}
          className={cn("min-h-9 rounded-full border px-3 text-[13px] font-medium transition-colors", value === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** A small strip: one series over the years, bars, one unit. */
function Strip({ title, unit, series, years, fmtV = (v: number) => fmt(v) }: { title: string; unit: string; series: Record<string, number | null>; years: string[]; fmtV?: (v: number) => string }) {
  const pts = years.map((y) => [Number(y), series[y]] as const).filter((p): p is readonly [number, number] => p[1] != null && p[1] > 0);
  if (!pts.length) return null;
  const W = 400, H = 64, ml = 44, mr = 10, x0 = Number(years[0]), x1 = Number(years[years.length - 1]);
  const mx = Math.max(...pts.map((p) => p[1])) * 1.1;
  const X = (yr: number) => ml + ((yr - x0) / Math.max(1, x1 - x0)) * (W - ml - mr);
  return (
    <figure className="m-0 grid gap-0.5">
      <figcaption className="flex justify-between text-xs"><span className="font-semibold">{title}</span><span className="font-mono text-muted-foreground">{unit}</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`${title}, ${x0} to ${x1}`}>
        <line x1={ml} x2={W - mr} y1={H - 14} y2={H - 14} stroke="var(--border)" />
        {years.map((y) => (Number(y) % 5 === 0 || y === years[years.length - 1]) && <text key={y} x={X(Number(y))} y={H - 2} textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8.5" fill="var(--muted-foreground)">{y.slice(2)}</text>)}
        {pts.map(([yr, v]) => { const h = (H - 20) * (v / mx); return <rect key={yr} x={X(yr) - 6} y={H - 14 - h} width="12" height={h} rx="3" fill="var(--foreground)"><title>{yr}: {fmtV(v)}</title></rect>; })}
        {pts.length && <text x={X(pts[pts.length - 1][0])} y={H - 14 - (H - 20) * (pts[pts.length - 1][1] / mx) - 3} textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="9" fill="var(--muted-foreground)">{fmtV(pts[pts.length - 1][1])}</text>}
      </svg>
    </figure>
  );
}

export default function ProvinceAtlas({ src, initial }: { src: string; initial?: number }) {
  const [data, setData] = useState<AtlasData | null>(null);
  const [year, setYear] = useState<string>("");
  const [measure, setMeasure] = useState<Measure>("production");
  const [variety, setVariety] = useState<Variety>("all");
  const [selected, setSelected] = useState<number | null>(initial ?? null);
  const [hover, setHover] = useState<{ name: string; value: number | null; x: number; y: number } | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch(src).then((r) => r.json()).then((d: AtlasData) => {
      setData(d); setYear(d.latest);
      const h = new URLSearchParams(location.hash.slice(1));
      if (h.get("p")) setSelected(Number(h.get("p"))); if (h.get("y") && d.years.includes(h.get("y")!)) setYear(h.get("y")!);
      if (h.get("m")) setMeasure(h.get("m") as Measure); if (h.get("v")) setVariety(h.get("v") as Variety);
    }).catch(() => {});
  }, [src]);
  useEffect(() => {
    if (!data) return;
    const h = new URLSearchParams(); h.set("y", year); h.set("m", measure); h.set("v", variety); if (selected) h.set("p", String(selected));
    history.replaceState(null, "", "#" + h.toString());
  }, [data, year, measure, variety, selected]);
  // The receipt is a sheet inside the map card: Escape closes it
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const unitLabel = MEASURES.find((m) => m.id === measure)!;
  const provinces = data?.provinces ?? [];
  const fills = useMemo(() => Object.fromEntries(provinces.map((p) => [p.psgc, binOf(measure, valueOf(p, measure, variety, year))])), [provinces, measure, variety, year]);
  const sel = provinces.find((p) => p.psgc === selected) ?? null;
  const hits = q.trim() ? provinces.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  const years = data?.years ?? [];
  const idx = years.indexOf(year);

  if (!data) return <div className="grid min-h-[480px] place-items-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">Loading the atlas…</div>;

  // Receipt numbers for the selected province
  const nat = data.national.production.all[year] ?? null;
  const t = sel ? sel.production.all[year] ?? null : null;
  const prev = sel ? sel.production.all[String(Number(year) - 1)] ?? null : null;
  const sentences = sel && t != null && nat ? provinceSentences(sel.name, year, t, nat, prev) : null;
  const reported = sel ? data.reported.filter((r) => r.province === sel.name) : [];
  const ranked = [...provinces].filter((p) => (p.production.all[year] ?? 0) > 0).sort((a, b) => (b.production.all[year] ?? 0) - (a.production.all[year] ?? 0));
  const rank = sel ? ranked.findIndex((p) => p.psgc === sel.psgc) + 1 : 0;

  return (
    <div className="grid gap-5">
      {/* One filter row above everything it scopes */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="grid flex-[0_1_300px] gap-1.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <button type="button" aria-label="Previous year" disabled={idx <= 0} onClick={() => setYear(years[idx - 1])} className="min-h-8 rounded-full border border-border px-2.5 disabled:opacity-40">‹</button>
            Year <span className="font-mono text-base font-medium tabular-nums">{year}</span>
            <button type="button" aria-label="Next year" disabled={idx >= years.length - 1} onClick={() => setYear(years[idx + 1])} className="min-h-8 rounded-full border border-border px-2.5 disabled:opacity-40">›</button>
          </div>
          <input type="range" min={0} max={years.length - 1} value={Math.max(0, idx)} onChange={(e) => setYear(years[Number(e.target.value)])} aria-label="Year" className="w-full accent-primary-strong" />
        </div>
        <Chips label="Measure" items={MEASURES.map((m) => ({ id: m.id, label: m.label }))} value={measure} onChange={setMeasure} />
        {measure !== "cpi" && <Chips label="Variety" items={VARIETIES} value={variety} onChange={setVariety} />}
        <div className="relative">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a province" aria-label="Find a province" className="min-h-9 w-44 rounded-full border border-border bg-background px-3 text-[13px]" />
          {hits.length > 0 && (
            <ul className="absolute left-0 top-full z-10 mt-1 w-56 list-none rounded-lg border border-border bg-card p-1 shadow-lg">
              {hits.map((p) => <li key={p.psgc}><button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { setSelected(p.psgc); setQ(""); }}>{p.name}</button></li>)}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-5">
        {/* The map, full width; the receipt opens as a sheet over it */}
        <div className="relative min-h-[620px] overflow-hidden rounded-2xl border border-border bg-card p-4" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${data.box.w} ${data.box.h}`} className="mx-auto block h-auto max-h-[760px] w-full max-w-[520px]" role="img" aria-label={`${unitLabel.unit} by province, ${year}`}>
            {provinces.map((p) => {
              const v = valueOf(p, measure, variety, year);
              return (
                <path key={p.psgc} d={p.d} fill={RAMP[fills[p.psgc]]} stroke={selected === p.psgc ? "var(--foreground)" : "var(--card)"} strokeWidth={selected === p.psgc ? 1.6 : 0.7}
                  tabIndex={0} role="button" aria-label={`${p.name}: ${v == null ? "none reported" : fmt(v, measure === "yield" ? 2 : 0) + " " + unitLabel.short}`}
                  className="cursor-pointer outline-none focus-visible:stroke-foreground"
                  onMouseMove={(e) => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setHover({ name: p.name, value: v, x: e.clientX - r.left, y: e.clientY - r.top }); }}
                  onClick={() => setSelected(p.psgc)} onKeyDown={(e) => e.key === "Enter" && setSelected(p.psgc)} />
              );
            })}
          </svg>
          {hover && (
            <div className="pointer-events-none absolute z-10 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-md" style={{ left: hover.x + 14, top: hover.y + 14 }}>
              <span className="font-semibold">{hover.name}</span>: {hover.value == null ? "none reported" : `${fmt(hover.value, measure === "yield" ? 2 : 0)} ${unitLabel.short}`}
            </div>
          )}
          <div className="mt-3 grid gap-1.5 text-[11.5px] text-muted-foreground">
            <div className="flex gap-1">{RAMP.map((c, i) => <span key={i} className="grid flex-1 gap-1 text-center"><span className="block h-2.5 rounded-sm" style={{ background: c }} /><span className="font-mono text-[9.5px]">{BIN_LABELS(measure)[i]}</span></span>)}</div>
            <span>{unitLabel.unit}, {year}{measure !== "cpi" && variety !== "all" ? `, ${VARIETIES.find((v) => v.id === variety)!.label}` : ""}. Every fill is a PSA count for the province in the chosen year. Tap a province for its receipt.</span>
          </div>
          {/* The province receipt: a sheet inside the map card, from the right on wide screens, from the bottom on phones */}
          {sel && (
            <div className="absolute inset-0 z-20" role="presentation">
              <button type="button" aria-label="Close the receipt" onClick={() => setSelected(null)} className="tanim-backdrop absolute inset-0 bg-foreground/15" />
              <aside role="dialog" aria-label={`${sel.name} receipt`} className="tanim-sheet absolute inset-x-0 bottom-0 grid grid-cols-[minmax(0,1fr)] max-h-[85%] content-start gap-4 overflow-y-auto overscroll-contain rounded-t-2xl border-t border-border bg-card p-5 shadow-[0_-12px_32px_-16px_rgba(40,25,15,.35)] lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[min(440px,100%)] lg:max-h-none lg:rounded-none lg:rounded-l-2xl lg:border-t-0 lg:border-l lg:shadow-[-12px_0_32px_-16px_rgba(40,25,15,.35)]">
                <>
                  <div className="flex items-center justify-between gap-2"><span className="label-mono">Province receipt</span><button type="button" aria-label="Close the receipt" onClick={() => setSelected(null)} className="size-8 rounded-full border border-border text-muted-foreground">×</button></div>
                  <div className="receipt-shadow"><div className="receipt rounded-t-md px-5 pt-4 font-mono text-[12.5px] leading-relaxed">
                    <div className="flex justify-between text-[10px] tracking-[0.18em] [color:var(--paper-muted)]"><span>TANIM · {sel.region.toUpperCase()}</span><span>{year}</span></div>
                    <div className="my-2 font-heading font-semibold text-[24px] leading-tight">{sel.name} <span className="font-sans text-xs [color:var(--paper-muted)]">province</span></div>
                    <div className="receipt-rule"></div>
                    <dl className="m-0 my-2 grid gap-0.5">
                      {([
                        ["KIND", "counted · PSA"],
                        [`GREEN COFFEE, ${year}`, t == null ? "none reported" : `${fmt(t)} t`],
                        ["ROBUSTA · ARABICA", `${fmt(sel.production.robusta[year])} · ${fmt(sel.production.arabica[year])}`],
                        ["EXCELSA · LIBERICA", `${fmt(sel.production.excelsa[year])} · ${fmt(sel.production.liberica[year])}`],
                        ["HECTARES · TREES", `${fmt(sel.area.all[year])} · ${fmt(sel.trees.all[year])}`],
                        ["SHARE OF COUNTRY", t != null && nat ? saying(t / nat, "en") : "…"],
                        ["RANK", rank ? `${rank} of ${ranked.length} reporting` : "…"],
                        ["VS LAST YEAR", t != null && prev ? `${(t / prev - 1) * 100 >= 0 ? "+" : ""}${((t / prev - 1) * 100).toFixed(1)} %` : "…"],
                        [`COFFEE CPI, ${year}`, sel.cpi[year] ? `${sel.cpi[year].toFixed(1)} (2018 = 100)` : "…"],
                        ["SPENT ON COFFEE", sel.fies["All Income Groups"] != null ? `${sel.fies["All Income Groups"].toFixed(1)} % of family budget (2023)` : "…"],
                      ] as [string, string][]).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="[color:var(--paper-muted)]">{k}</dt><dd className="m-0 text-right">{v}</dd></div>)}
                    </dl>
                    <div className="receipt-rule"></div>
                    <div className="mt-2 flex justify-between font-medium"><span>TOTAL</span><span>1 COUNTED PROVINCE</span></div>
                    {sel.note && <div className="mt-2 text-[11px] leading-snug [color:var(--paper-muted)]">{sel.note}</div>}
                  </div></div>

                  {sentences && (
                    <section aria-labelledby="ra-h" className="grid gap-2">
                      <h3 id="ra-h" className="label-mono m-0">Sa simpleng salita · read aloud</h3>
                      <blockquote className="m-0 border-l-[3px] border-primary pl-3.5 text-[14.5px] leading-relaxed"><p className="m-0">{sentences.fil}</p><p className="m-0 mt-1.5 text-muted-foreground">{sentences.en} A survey count by the Philippine Statistics Authority; PSA publishes no margin for it.</p></blockquote>
                      <button type="button" className="justify-self-start rounded-full border border-border px-3 py-1.5 text-[13px]" onClick={() => navigator.clipboard?.writeText(`${sentences.fil}\n${sentences.en}\nSource: PSA OpenSTAT, via Tanim ${location.href}`)}>Copy this receipt</button>
                    </section>
                  )}

                  {nat && (
                    <figure className="m-0 grid gap-1.5">
                      <figcaption className="text-[12.5px] font-semibold">The country's {fmt(nat)} t, province by province</figcaption>
                      <div className="flex h-5 overflow-hidden rounded-md" aria-hidden="true">
                        {ranked.map((p) => <span key={p.psgc} title={`${p.name}: ${fmt(p.production.all[year])} t`} style={{ width: `${((p.production.all[year] ?? 0) / nat) * 100}%`, background: p.psgc === sel.psgc ? "var(--primary-strong)" : "var(--rosas-3)", marginRight: 1.5 }} />)}
                      </div>
                      <span className="text-[11.5px] text-muted-foreground">Dark: {sel.name}. {ranked.length} provinces reported coffee in {year}.</span>
                    </figure>
                  )}

                  <div className="grid gap-3">
                    <Strip title="Green coffee, counted" unit="tonnes" series={sel.production.all} years={years} />
                    <Strip title="Robusta farmgate price, counted" unit="PHP per kg, yearly average" series={sel.farmgate.robusta} years={years} fmtV={(v) => v.toFixed(0)} />
                    {Object.keys(sel.cpi).length > 0 && <Strip title="A cup's price here, counted" unit="coffee CPI, 2018 = 100" series={sel.cpi} years={Object.keys(sel.cpi).sort()} fmtV={(v) => v.toFixed(0)} />}
                  </div>

                  {reported.length > 0 && (
                    <section aria-labelledby="ss-h" className="grid gap-1.5">
                      <h3 id="ss-h" className="label-mono m-0">Someone said · reported, not counted</h3>
                      {reported.map((r) => <div key={r.url} className="flex justify-between gap-3 rounded-lg border-[1.5px] border-muted-foreground px-2.5 py-2 text-[13px] leading-relaxed"><span>{r.text}</span><a href={r.url} target="_blank" rel="noopener" className="whitespace-nowrap font-mono text-[11px] text-primary-strong">{r.source.split(",")[0]} · {r.date} ↗</a></div>)}
                      <span className="text-[11.5px] text-muted-foreground">Outlined, with the link and date. Never drawn on the map, never added to PSA's figures.</span>
                    </section>
                  )}

                  <details className="text-[13px]">
                    <summary className="cursor-pointer text-muted-foreground">All years</summary>
                    <table className="mt-2 w-full border-collapse text-left"><thead><tr className="border-b border-border text-muted-foreground"><th className="py-1 font-medium">Year</th><th className="font-medium">Tonnes</th><th className="font-medium">Robusta</th><th className="font-medium">Arabica</th><th className="font-medium">Hectares</th><th className="font-medium">Trees</th></tr></thead>
                      <tbody className="font-mono text-xs">{years.map((y) => <tr key={y} className="border-b border-border/60"><td className="py-1">{y}</td><td>{fmt(sel.production.all[y])}</td><td>{fmt(sel.production.robusta[y])}</td><td>{fmt(sel.production.arabica[y])}</td><td>{fmt(sel.area.all[y])}</td><td>{fmt(sel.trees.all[y])}</td></tr>)}</tbody></table>
                  </details>
                </>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
