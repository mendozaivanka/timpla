import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type BranchRow = {
  /** specialty rows have a receipt page; the rest link out (Instagram, website or OpenStreetMap) */
  cls: "specialty" | "independent" | "multibranch";
  href: string;
  /** label of the outbound link, for rows without a receipt page */
  external?: string;
  slug: string;
  name: string;
  branch: string;
  tier?: "acclaimed" | "recognised" | "indie";
  where: string;
  city: string;
  beans: string;
  since: string;
  /** "Checked on OpenStreetMap, Mar 2025" for rows that entered on map evidence */
  evidence?: string;
};

type Cls = "all" | BranchRow["cls"];
const CLASSES: { id: Cls; label: string }[] = [
  { id: "all", label: "All cafés" },
  { id: "specialty", label: "Specialty" },
  { id: "independent", label: "Independent" },
  { id: "multibranch", label: "Multi-branch" },
];
type Tier = "all" | NonNullable<BranchRow["tier"]>;
const TIERS: { id: Tier; label: string }[] = [
  { id: "all", label: "All" },
  { id: "acclaimed", label: "Acclaimed" },
  { id: "recognised", label: "Recognised" },
  { id: "indie", label: "Indie" },
];

type Props = {
  rows: BranchRow[];
  /** Show only the first N rows (home page); the directory shows everything. */
  limit?: number;
  /** Directory mode: adds search and a city filter. */
  full?: boolean;
};

function Chips<T extends string>({ label, items, value, onChange }: {
  label: string; items: { id: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
            value === t.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** The branch list with class and tier filters (from design B, in A's typography). */
export default function BranchList({ rows, limit, full = false }: Props) {
  const [cls, setCls] = useState<Cls>("all");
  const [tier, setTier] = useState<Tier>("all");
  const [city, setCity] = useState("all");
  const [q, setQ] = useState("");

  const mixed = useMemo(() => rows.some((r) => r.cls !== "specialty"), [rows]);
  // Tiers only exist inside specialty, so their chips only show when the list is specialty-only
  const showTiers = !mixed || cls === "specialty";
  const cities = useMemo(() => [...new Set(rows.map((r) => r.city).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (cls === "all" || r.cls === cls) &&
        (!showTiers || tier === "all" || r.tier === tier) &&
        (city === "all" || r.city === city) &&
        (!needle || `${r.name} ${r.branch} ${r.where} ${r.beans}`.toLowerCase().includes(needle)),
    );
  }, [rows, cls, showTiers, tier, city, q]);
  // Preview mode (home page): one row per café, so a multi-branch shop doesn't fill the list
  const shown = limit
    ? filtered.filter((r, i, a) => a.findIndex((x) => x.slug === r.slug) === i).slice(0, limit)
    : filtered;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {mixed && <Chips label="Filter by kind of café" items={CLASSES} value={cls} onChange={setCls} />}
        {showTiers && <Chips label="Filter by tier" items={TIERS} value={tier} onChange={setTier} />}
        {full && (
          <>
            <label className="sr-only" htmlFor="branch-city">City</label>
            <select
              id="branch-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="min-h-11 rounded-full border border-border bg-card px-4 text-sm"
            >
              <option value="all">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="branch-q">Search</label>
            <input
              id="branch-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search cafés, roasters, places"
              className="min-h-11 min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-sm sm:max-w-xs"
            />
          </>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <p className="m-0 border-b border-dashed border-border px-5 py-3 font-mono text-xs text-muted-foreground" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "branch" : "branches"}
          {limit && filtered.length > limit ? `, showing ${shown.length} cafés` : ""}
        </p>
        <ul className="m-0 list-none p-0">
          {shown.map((r) => (
            <li key={`${r.slug}-${r.branch}`} className="border-b border-dashed border-border last:border-b-0">
              <a
                href={r.href}
                {...(r.external ? { target: "_blank", rel: "noopener" } : {})}
                className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-muted/60"
              >
                <span className="tier-dot" data-tier={r.tier ?? r.cls} title={r.tier ?? r.cls} />
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-[19px] leading-snug">
                    {r.name}
                    {r.branch && <span className="text-muted-foreground"> · {r.branch}</span>}
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {[r.where, r.beans, r.evidence].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-xs text-muted-foreground">
                  {r.since ? <>since<br />{r.since}</> : r.external ? <>{r.external} ↗<span className="sr-only"> (opens in a new tab)</span></> : "—"}
                </span>
              </a>
            </li>
          ))}
          {shown.length === 0 && <li className="px-5 py-6 text-muted-foreground">No branches match.</li>}
        </ul>
        {limit && (
          <a href="/timpla/cafes/" className="block border-t border-dashed border-border px-5 py-3.5 font-semibold text-primary-strong">
            See the full directory →
          </a>
        )}
      </div>
    </div>
  );
}
