import type { BranchRow } from "@/components/timpla/BranchList";

export type Branch = {
  name: string; neighbourhood: string; city: string; address: string;
  lat: number | null; lon: number | null; coordSource: string;
};
export type Shop = {
  slug: string; name: string; tier: "acclaimed" | "recognised" | "indie"; type: string; ownership: string;
  beans: string; since: string; endorsements: number; sources: { outlet: string; url: string }[];
  signals: string[]; specialty: string; status: string; website: string; instagram: string; branches: Branch[];
};

// Data comes from the data layer (getShops / getIndependents in @/lib/data); this file only holds helpers.

export const instagramUrl = (h: string) => {
  const handle = h.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*/, "").trim();
  return handle ? { handle, url: `https://www.instagram.com/${handle}/` } : null;
};

export const TIER_TEXT: Record<Shop["tier"], string> = {
  acclaimed: "2+ independent write-ups, or an award",
  recognised: "1 write-up, roaster pedigree, or a festival / stockist listing",
  indie: "specialty and open, no press yet",
};

/** Short "Legazpi Village, Makati" from a branch, never repeating the city. */
export const whereOf = (b: Pick<Branch, "neighbourhood" | "city">) =>
  [b.neighbourhood?.trim(), b.city].filter((x, i, a) => x && a.indexOf(x) === i && !(i === 0 && x === a[1])).join(", ");

/** Shorten long evidence strings for list rows. */
export const shortBeans = (s: string) => {
  const t = s.split(/[;(]/)[0].trim();
  return t.length > 42 ? t.slice(0, 40).trimEnd() + "…" : t;
};

/** A café in the wider directory: no receipt page, just where it is and why we think it's open. */
export type Independent = {
  id: string; name: string; cls: "independent" | "multibranch"; city: string; lon: number; lat: number;
  n: number; ev: "osm_check" | "overture_2026_09"; evd: string; ig: string; web: string;
};

export const CLASS_TEXT = {
  specialty: "Roasts, names its roaster or origin, or brews by method; checked open in 2025–26",
  independent: "No chain signal found, seen recently by OpenStreetMap or a live business page",
  multibranch: "A local brand with 4–9 locations in Metro Manila",
} as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (d: string) => (d.length >= 7 ? `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : d);
/** "Checked on OpenStreetMap, Mar 2025" / "Business page live, Sep 2026" */
export const evidenceText = (ev: string, date: string) =>
  ev === "osm_check" ? `Checked on OpenStreetMap, ${monthYear(date)}`
  : ev === "overture_2026_09" ? `Business page live, ${monthYear(date)}`
  : "Press or own site, 2025–26";

/** Where a directory café links to: its Instagram, its site, or its OpenStreetMap entry. */
export const outLink = (c: Pick<Independent, "id" | "ig" | "web">) => {
  const ig = c.ig && instagramUrl(c.ig);
  if (ig) return { href: ig.url, label: "Instagram" };
  if (c.web) return { href: c.web.startsWith("http") ? c.web : `https://${c.web}`, label: "Website" };
  const type = { n: "node", w: "way", r: "relation" }[c.id[0]] ?? "node";
  return { href: `https://www.openstreetmap.org/${type}/${c.id.slice(1)}`, label: "OpenStreetMap" };
};

/** One row per branch, best tier first, then most written-about. */
export const toBranchRows = (shops: Shop[]): BranchRow[] => shops.flatMap((s) =>
  s.branches.map((b) => ({
    cls: "specialty" as const,
    href: `/timpla/cafes/${s.slug}/`,
    slug: s.slug,
    name: s.name,
    branch: s.branches.length > 1 ? b.name : "",
    tier: s.tier,
    where: whereOf(b),
    city: b.city,
    beans: shortBeans(s.beans),
    since: s.since,
  })),
);

/** The whole directory: specialty branches first (as above), then everyone else by city and name. */
export const toDirectoryRows = (shops: Shop[], independents: Independent[]): BranchRow[] => [
  ...toBranchRows(shops),
  ...[...independents]
    .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
    .map((c) => {
      const link = outLink(c);
      return {
        cls: c.cls, href: link.href, external: link.label, slug: c.id, name: c.name, branch: "",
        where: c.city, city: c.city, beans: c.cls === "multibranch" ? `${c.n} locations` : "",
        since: "", evidence: evidenceText(c.ev, c.evd),
      };
    }),
];
