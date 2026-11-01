import { useEffect, useRef, useState } from "react";
import {
  GeoJSONSource, LngLatBounds, MapLibreMap, NavigationControl, Popup, setWorkerUrl, type ExpressionSpecification,
  type GeoJSONSourceSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre renders tiles in a web worker that Vite's dependency pre-bundling separates from the main file;
// point at it explicitly (`?url` serves it in dev and copies it, hashed, into the build).
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { effectiveTheme, onThemeChange } from "@/lib/theme";
import { cn } from "@/lib/utils";

setWorkerUrl(workerUrl);

/* Basemap: OpenFreeMap (free, no API key), tinted towards the Kape't Gatas palette. */
const STYLE = { light: "https://tiles.openfreemap.org/styles/positron", dark: "https://tiles.openfreemap.org/styles/dark" };
const TINT = {
  light: { background: "#f7f1e9", water: "#dde6ea", park: "#e7ebdf", building: "#efe5d9" },
  dark: { background: "#1a1310", water: "#1c252b", park: "#1f231b", building: "#261d17" },
};
const TIER = {
  light: { acclaimed: "#3b2016", recognised: "#8b4a26", indie: "#8b4a26", ring: "#ffffff", muted: "#6e5b4e", cluster: "#e8c9a9", faint: "#a8958a" },
  dark: { acclaimed: "#f0c9a4", recognised: "#b9774c", indie: "#f0c9a4", ring: "#1a1310", muted: "#bba795", cluster: "#4a3426", faint: "#6f6158" },
};

export type MapPoint = {
  slug: string; name: string; branch: string; tier: "acclaimed" | "recognised" | "indie";
  city: string; nb: string; lon: number; lat: number; beans?: string; since?: string;
};
/** A café from the wider directory: no receipt page, so the card carries the evidence and an outbound link. */
export type OtherPoint = {
  name: string; cls: "independent" | "multibranch"; city: string; lon: number; lat: number;
  n: number; evidence: string; href: string; linkLabel: string;
};

type Kind = "all" | "specialty" | OtherPoint["cls"];
type TierFilter = "all" | MapPoint["tier"];
const KINDS: { id: Kind; label: string }[] = [
  { id: "all", label: "All cafés" },
  { id: "specialty", label: "Specialty" },
  { id: "independent", label: "Independent" },
  { id: "multibranch", label: "Multi-branch" },
];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const shortLabel = (name: string) => name.replace(/\s*\(.*?\)\s*/g, " ").trim();

const row = (k: string, v: string) =>
  v ? `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#6f6066">${k}</span><span style="text-align:right">${esc(v)}</span></div>` : "";
const RULE = `<div style="border-top:1.5px dashed #d9cfd2;margin:6px 0"></div>`;
const card = (title: string, sub: string, rows: string, link: string) =>
  `<div style="font:13px/1.5 'DM Mono',monospace;color:#2b2226;min-width:200px">` +
  `<div style="font:500 18px/1.2 Newsreader,serif;margin-bottom:2px">${esc(title)}</div>` +
  (sub ? `<div style="font:13px Figtree,sans-serif;color:#6f6066">${esc(sub)}</div>` : "") +
  RULE + rows + (link ? RULE + link : "") + `</div>`;
const linkHtml = (href: string, text: string, external: boolean) =>
  `<a href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ""} style="font:600 14px Figtree,sans-serif;color:#8b4a26">${esc(text)}</a>`;

/** Details card: on hover (no link) and on click/tap (with the link). */
function specialtyCard(p: MapPoint, withLink: boolean) {
  return card(
    p.name, p.branch,
    row("WHERE", [p.nb, p.city].filter((x, i, a) => x && a.indexOf(x) === i).join(", ")) +
      row("SINCE", p.since || "") + row("BEANS", p.beans || "") + row("TIER", `specialty · ${p.tier}`),
    withLink ? linkHtml(`/timpla/cafes/${p.slug}/`, "Open the receipt →", false) : "",
  );
}
/** Several cafés in one building (e.g. Westgate Alabang): one card listing each, with its own receipt link. */
function placeCard(members: MapPoint[], withLink: boolean) {
  if (members.length === 1) return specialtyCard(members[0], withLink);
  const where = [members[0].nb, members[0].city].filter((x, i, a) => x && a.indexOf(x) === i).join(", ");
  const items = members.map((p) =>
    `<div style="margin:6px 0">` +
    `<div style="font:500 16px/1.2 Newsreader,serif">${esc(p.name)}</div>` +
    `<div style="color:#6f6066">${esc([p.since && `since ${p.since}`, `specialty · ${p.tier}`].filter(Boolean).join(" · "))}</div>` +
    (withLink ? linkHtml(`/timpla/cafes/${p.slug}/`, "Open the receipt →", false) : "") +
    `</div>`).join("");
  return card(`${members.length} cafés here`, where, items, "");
}

const TIER_ORDER = { acclaimed: 0, recognised: 1, indie: 2 } as const;
/** Cafés within ~25 m of each other share a dot: geocoding often puts two shops in one building at the same point,
 *  and a dot drawn exactly on top of another can't be seen, hovered or tapped. */
function groupByPlace(points: MapPoint[]) {
  const near = (a: MapPoint, b: MapPoint) =>
    Math.hypot((a.lat - b.lat) * 111_320, (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180)) < 25;
  const groups: MapPoint[][] = [];
  for (const p of points) {
    const g = groups.find((g) => g.some((q) => near(p, q)));
    if (g) g.push(p);
    else groups.push([p]);
  }
  return groups.map((g) => {
    g.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
    const names = [...new Set(g.map((p) => shortLabel(p.name)))];
    return {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [g[0].lon, g[0].lat] },
      properties: {
        tier: g[0].tier,
        tiers: g.map((p) => p.tier).join(","),
        label: names.length <= 2 ? names.join(" · ") : `${names[0]} +${names.length - 1} more`,
        members: JSON.stringify(g),
      },
    };
  });
}

function otherCard(p: OtherPoint, withLink: boolean) {
  return card(
    p.name, "",
    row("WHERE", p.city) +
      row("KIND", p.cls === "multibranch" ? `multi-branch · ${p.n} locations` : "independent") +
      row("OPEN", p.evidence),
    withLink ? linkHtml(p.href, `${p.linkLabel} ↗`, true) : "",
  );
}
function unverifiedCard(name: string) {
  return card(name, "", row("STATUS", "unverified") + row("SOURCE", "OpenStreetMap only"), "");
}

export default function CafeMap({ points, others, unverified, embed = false }: {
  points: MapPoint[]; others: OtherPoint[]; unverified: [number, number, string][];
  /** Map only, filling its frame, for /timpla/embed/ (shown in an iframe on the portfolio). */
  embed?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const [tier, setTier] = useState<TierFilter>("all");
  const [showUnverified, setShowUnverified] = useState(false);
  const state = useRef({ kind, tier, showUnverified });
  state.current = { kind, tier, showUnverified };

  // Build (and rebuild on theme change) the map
  useEffect(() => {
    if (!box.current) return;
    let map: MapLibreMap | null = null;

    const build = () => {
      const scheme = effectiveTheme();
      const center = map?.getCenter();
      const zoom = map?.getZoom();
      map?.remove();
      map = new MapLibreMap({
        container: box.current!,
        style: STYLE[scheme],
        center: center ?? [121.03, 14.57],
        zoom: zoom ?? 11,
        maxZoom: 17,
        attributionControl: { compact: true },
        // Inside another page, scrolling should scroll that page: zoom needs ⌘/Ctrl + scroll (two fingers on touch)
        cooperativeGestures: embed || window.matchMedia("(pointer: coarse)").matches,
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
      map.on("load", () => {
        const m = map!;
        const t = TINT[scheme];
        for (const [layer, prop, value] of [
          ["background", "background-color", t.background],
          ["water", "fill-color", t.water],
          ["park", "fill-color", t.park],
          ["building", "fill-color", t.building],
        ] as const) if (m.getLayer(layer)) m.setPaintProperty(layer, prop, value);

        const c = TIER[scheme];
        const ink = scheme === "dark" ? "#f3e9df" : "#2b1d16";
        const halo = scheme === "dark" ? "#1a1310" : "#fffdf9";
        const labelLayout = {
          "text-font": ["Noto Sans Regular"],
          // Try right first, then the other sides, so two close dots can both keep a name
          "text-variable-anchor": ["left", "right", "top", "bottom"] as ("left" | "right" | "top" | "bottom")[],
          "text-radial-offset": 0.75,
          "text-justify": "auto" as const,
          "text-max-width": 9,
          "text-optional": true,
        };

        // 1. OSM cafés with no recent evidence: faint dots, off by default
        m.addSource("unverified", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: unverified.map(([lon, lat, name]) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: { name } })),
          },
        });
        m.addLayer({
          id: "unverified", type: "circle", source: "unverified",
          paint: { "circle-radius": 2.5, "circle-color": c.faint, "circle-opacity": 0.7 },
        });

        // 2. Independent and multi-branch cafés, clustered until street level so the specialty dots stay readable
        m.addSource("others", { type: "geojson", data: othersData(others, state.current.kind), cluster: true, clusterRadius: 40, clusterMaxZoom: 13 });
        m.addLayer({
          id: "others-clusters", type: "circle", source: "others", filter: ["has", "point_count"],
          paint: {
            "circle-color": c.cluster,
            "circle-opacity": 0.85,
            "circle-radius": ["step", ["get", "point_count"], 11, 10, 14, 40, 18],
            "circle-stroke-color": c.muted,
            "circle-stroke-width": 1,
          },
        });
        m.addLayer({
          id: "others-count", type: "symbol", source: "others", filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-allow-overlap": true },
          paint: { "text-color": ink },
        });
        m.addLayer({
          id: "others", type: "circle", source: "others", filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 15, 6],
            "circle-color": ["match", ["get", "cls"], "multibranch", c.muted, c.ring],
            "circle-stroke-color": c.muted,
            "circle-stroke-width": 1.5,
          },
        });
        m.addLayer({
          id: "others-labels", type: "symbol", source: "others", minzoom: 14, filter: ["!", ["has", "point_count"]],
          layout: { ...labelLayout, "text-field": ["get", "label"], "text-size": 12, "symbol-sort-key": 3 },
          paint: { "text-color": c.muted, "text-halo-color": halo, "text-halo-width": 1.6 },
        });

        // 3. Specialty cafés on top, never clustered, with their names beside the dots
        m.addSource("cafes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: groupByPlace(points) },
        });
        m.addLayer({
          id: "cafes", type: "circle", source: "cafes",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 15, 8],
            "circle-color": ["match", ["get", "tier"], "acclaimed", c.acclaimed, "recognised", c.recognised, c.ring],
            "circle-stroke-color": ["match", ["get", "tier"], "indie", c.indie, c.ring],
            "circle-stroke-width": ["match", ["get", "tier"], "indie", 2.2, 1.5],
          },
        });
        // MapLibre hides labels that would collide, so more appear as you zoom in; acclaimed cafés get first claim.
        m.addLayer({
          id: "cafe-labels", type: "symbol", source: "cafes",
          layout: {
            ...labelLayout,
            "text-field": ["get", "label"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 15, 13],
            "symbol-sort-key": ["match", ["get", "tier"], "acclaimed", 0, "recognised", 1, 2],
          },
          paint: { "text-color": ink, "text-halo-color": halo, "text-halo-width": 1.6 },
        });
        applyFilters(m, state.current, others);
        if (!center) {
          const b = new LngLatBounds();
          points.forEach((p) => b.extend([p.lon, p.lat]));
          m.fitBounds(b, { padding: 48, duration: 0, maxZoom: 14 });
        }

        // Hover (mouse): a light card follows the pointer. Click / tap: the card stays, with a link.
        const hover = new Popup({ offset: 12, maxWidth: "280px", closeButton: false, closeOnClick: false });
        const coordsOf = (f: { geometry: unknown }) => (f.geometry as { coordinates: [number, number] }).coordinates;
        const cards: [string[], (props: any, link: boolean) => string][] = [
          [["cafes", "cafe-labels"], (p, link) => placeCard(JSON.parse(p.members), link)],
          [["others", "others-labels"], otherCard],
          [["unverified"], (p) => unverifiedCard(p.name)],
        ];
        for (const [layers, render] of cards) {
          for (const layer of layers) {
            m.on("mousemove", layer, (e) => {
              const f = e.features?.[0];
              if (!f) return;
              m.getCanvas().style.cursor = "pointer";
              hover.setLngLat(coordsOf(f)).setHTML(render(f.properties, false)).addTo(m);
            });
            m.on("mouseleave", layer, () => {
              m.getCanvas().style.cursor = "";
              hover.remove();
            });
            m.on("click", layer, (e) => {
              const f = e.features?.[0];
              if (!f) return;
              hover.remove();
              new Popup({ offset: 12, maxWidth: "280px" }).setLngLat(coordsOf(f)).setHTML(render(f.properties, true)).addTo(m);
            });
          }
        }
        // A cluster zooms in to the level where it splits
        m.on("click", "others-clusters", async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const zoomTo = await (m.getSource("others") as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
          m.easeTo({ center: coordsOf(f), zoom: zoomTo, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400 });
        });
        m.on("mouseenter", "others-clusters", () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", "others-clusters", () => (m.getCanvas().style.cursor = ""));
      });
    };

    build();
    const off = onThemeChange(build);
    return () => {
      off();
      map?.remove();
      mapRef.current = null;
    };
  }, [points, others, unverified, embed]);

  // Filters: setFilter / setData, no rebuild of the map
  useEffect(() => {
    const m = mapRef.current;
    if (m?.getLayer("cafes")) applyFilters(m, { kind, tier, showUnverified }, others);
  }, [kind, tier, showUnverified, others]);

  const nSpecialty = kind === "all" || kind === "specialty" ? (tier === "all" ? points.length : points.filter((p) => p.tier === tier).length) : 0;
  const nOthers = kind === "specialty" ? 0 : others.filter((o) => kind === "all" || o.cls === kind).length;
  const showTiers = kind === "specialty";

  if (embed)
    return (
      <div
        ref={box}
        className="h-dvh w-full bg-muted"
        role="region"
        aria-label="Interactive map of independent cafés in Metro Manila"
      />
    );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by kind of café" className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                kind === k.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        {showTiers && (
          <div role="group" aria-label="Filter specialty cafés by tier" className="flex flex-wrap gap-2">
            {(["all", "acclaimed", "recognised", "indie"] as TierFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tier === t}
                onClick={() => setTier(t)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-medium capitalize transition-colors",
                  tier === t ? "border-primary-strong bg-card text-foreground ring-1 ring-primary-strong" : "border-border bg-card hover:bg-muted",
                )}
              >
                {t === "all" ? "All tiers" : t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="tier-dot" data-tier="acclaimed" />specialty (by tier)</span>
        <span className="inline-flex items-center gap-1.5"><span className="tier-dot" data-tier="independent" />independent</span>
        <span className="inline-flex items-center gap-1.5"><span className="tier-dot" data-tier="multibranch" />multi-branch</span>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showUnverified} onChange={(e) => setShowUnverified(e.target.checked)} className="size-4 accent-[var(--primary-strong)]" />
          Show {unverified.length} unverified OSM cafés
        </label>
        <span className="ml-auto font-mono text-xs" aria-live="polite">{nSpecialty + nOthers} cafés on the map</span>
      </div>
      <div
        ref={box}
        className="h-[min(70dvh,640px)] min-h-[380px] overflow-hidden rounded-2xl border border-border bg-muted"
        role="region"
        aria-label="Interactive map of independent cafés. The café directory has the same places as a list."
      />
    </div>
  );
}

function othersData(others: OtherPoint[], kind: Kind): Extract<GeoJSONSourceSpecification["data"], { type: "FeatureCollection" }> {
  const keep = kind === "all" ? others : kind === "specialty" ? [] : others.filter((o) => o.cls === kind);
  return {
    type: "FeatureCollection",
    features: keep.map((o) => ({ type: "Feature", geometry: { type: "Point", coordinates: [o.lon, o.lat] }, properties: { ...o, label: shortLabel(o.name) } })),
  };
}

function applyFilters(m: MapLibreMap, s: { kind: Kind; tier: TierFilter; showUnverified: boolean }, others: OtherPoint[]) {
  const specialtyOn = s.kind === "all" || s.kind === "specialty";
  // A shared dot shows when any café on it matches the tier
  const tierFilter: ExpressionSpecification | null = s.tier === "all" || s.kind !== "specialty" ? null : ["in", s.tier, ["get", "tiers"]];
  for (const id of ["cafes", "cafe-labels"]) {
    m.setLayoutProperty(id, "visibility", specialtyOn ? "visible" : "none");
    m.setFilter(id, tierFilter);
  }
  // Clusters are computed from the source data, so the kind filter swaps the data rather than filtering layers
  (m.getSource("others") as GeoJSONSource).setData(othersData(others, s.kind));
  m.setLayoutProperty("unverified", "visibility", s.showUnverified ? "visible" : "none");
}
