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

/* Basemap: OpenFreeMap (free, no API key), stripped back to match Sinturon's maps: flat land and water, with roads
   and place names only once you zoom in close. Cafés are translucent circles with a thin outline. */
const STYLE = { light: "https://tiles.openfreemap.org/styles/positron", dark: "https://tiles.openfreemap.org/styles/dark" };
const TINT = {
  light: { land: "#e9edf1", water: "#ffffff" },
  dark: { land: "#18202a", water: "#10151b" },
};
const TIER = {
  light: { acclaimed: "#8f3a5c", recognised: "#c86a8c", indie: "#c86a8c", independent: "#3f6178", multibranch: "#525c68", faint: "#9aa5b2" },
  dark: { acclaimed: "#f2a3bc", recognised: "#b55f80", indie: "#f2a3bc", independent: "#9cb7cb", multibranch: "#9aa5b2", faint: "#6c7887" },
};
/** Zoom at which streets, place names and café names appear, and clusters split into single cafés. */
const DETAIL_ZOOM = 13.5;
const FILL = 0.35;

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
  v ? `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#525c68">${k}</span><span style="text-align:right">${esc(v)}</span></div>` : "";
const RULE = `<div style="border-top:1px solid #dde2e8;margin:6px 0"></div>`;
const card = (title: string, sub: string, rows: string, link: string) =>
  `<div style="font:12px/1.55 'Red Hat Mono Variable','Red Hat Mono',monospace;color:#18202b;min-width:200px">` +
  `<div style="font:600 16px/1.25 'Manrope Variable',Manrope,sans-serif;margin-bottom:2px">${esc(title)}</div>` +
  (sub ? `<div style="font:13px 'Manrope Variable',Manrope,sans-serif;color:#525c68">${esc(sub)}</div>` : "") +
  RULE + rows + (link ? RULE + link : "") + `</div>`;
const linkHtml = (href: string, text: string, external: boolean) =>
  `<a href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ""} style="font:600 13px 'Manrope Variable',Manrope,sans-serif;color:#8f3a5c">${esc(text)}</a>`;

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
    `<div style="font:600 14px/1.25 'Manrope Variable',Manrope,sans-serif">${esc(p.name)}</div>` +
    `<div style="color:#525c68">${esc([p.since && `since ${p.since}`, `specialty · ${p.tier}`].filter(Boolean).join(" · "))}</div>` +
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
        // Flatten the basemap: one land colour, one water colour; roads and labels wait for DETAIL_ZOOM
        for (const layer of m.getStyle().layers) {
          const id = layer.id;
          if (layer.type === "background") m.setPaintProperty(id, "background-color", t.land);
          else if (layer.type === "fill") {
            if (/water/.test(id)) m.setPaintProperty(id, "fill-color", t.water);
            else if (/building/.test(id)) m.setLayerZoomRange(id, 15, 24);
            else m.setLayoutProperty(id, "visibility", "none"); // parks, landuse, landcover
          } else if (layer.type === "line" || layer.type === "symbol") {
            m.setLayerZoomRange(id, DETAIL_ZOOM, 24);
          }
        }

        const c = TIER[scheme];
        const ink = scheme === "dark" ? "#e9eef3" : "#18202b";
        const halo = scheme === "dark" ? "#10151b" : "#ffffff";
        // Circle area grows with the number of cafés it stands for
        const sized = (base: number): ExpressionSpecification => ["+", base, ["*", 3.2, ["sqrt", ["get", "point_count"]]]];
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
          paint: { "circle-radius": 2.2, "circle-color": c.faint, "circle-opacity": 0.6 },
        });

        // 2. Independent and multi-branch cafés, clustered until street level so the specialty dots stay readable
        m.addSource("others", {
          type: "geojson", data: othersData(others, state.current.kind), cluster: true, clusterRadius: 28, clusterMaxZoom: DETAIL_ZOOM - 0.5,
          clusterProperties: { multi: ["+", ["case", ["==", ["get", "cls"], "multibranch"], 1, 0]] },
        });
        const othersColor: ExpressionSpecification = ["case", ["has", "point_count"],
          ["case", [">", ["*", 2, ["get", "multi"]], ["get", "point_count"]], c.multibranch, c.independent],
          ["match", ["get", "cls"], "multibranch", c.multibranch, c.independent]];
        m.addLayer({
          id: "others-clusters", type: "circle", source: "others", filter: ["has", "point_count"],
          paint: {
            "circle-color": othersColor, "circle-opacity": FILL,
            "circle-radius": sized(2),
            "circle-stroke-color": othersColor, "circle-stroke-width": 1, "circle-stroke-opacity": 0.9,
          },
        });
        m.addLayer({
          id: "others", type: "circle", source: "others", filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 15, 6],
            "circle-color": othersColor, "circle-opacity": FILL,
            "circle-stroke-color": othersColor, "circle-stroke-width": 1, "circle-stroke-opacity": 0.9,
          },
        });
        m.addLayer({
          id: "others-labels", type: "symbol", source: "others", minzoom: 14, filter: ["!", ["has", "point_count"]],
          layout: { ...labelLayout, "text-field": ["get", "label"], "text-size": 12, "symbol-sort-key": 3 },
          paint: { "text-color": c.multibranch, "text-halo-color": halo, "text-halo-width": 1.6 },
        });

        // 3. Specialty cafés on top: grouped into sized circles when zoomed out, single cafés with names up close.
        //    A group takes the acclaimed colour when most of its cafés are acclaimed.
        m.addSource("cafes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: groupByPlace(points) },
          cluster: true, clusterRadius: 28, clusterMaxZoom: DETAIL_ZOOM - 0.5,
          clusterProperties: { acclaimed: ["+", ["case", ["==", ["get", "tier"], "acclaimed"], 1, 0]] },
        });
        const cafeColor: ExpressionSpecification = ["case", ["has", "point_count"],
          ["case", [">=", ["*", 2, ["get", "acclaimed"]], ["get", "point_count"]], c.acclaimed, c.recognised],
          ["match", ["get", "tier"], "acclaimed", c.acclaimed, "recognised", c.recognised, c.indie]];
        m.addLayer({
          id: "cafe-clusters", type: "circle", source: "cafes", filter: ["has", "point_count"],
          paint: {
            "circle-color": cafeColor, "circle-opacity": FILL,
            "circle-radius": sized(2),
            "circle-stroke-color": cafeColor, "circle-stroke-width": 1, "circle-stroke-opacity": 0.9,
          },
        });
        m.addLayer({
          id: "cafes", type: "circle", source: "cafes", filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4.5, 15, 8],
            "circle-color": cafeColor,
            "circle-opacity": ["match", ["get", "tier"], "indie", 0, FILL],
            "circle-stroke-color": cafeColor,
            "circle-stroke-width": ["match", ["get", "tier"], "indie", 2, 1],
            "circle-stroke-opacity": 0.9,
          },
        });
        // Names only once the circles have split; MapLibre hides labels that would collide, acclaimed cafés first.
        m.addLayer({
          id: "cafe-labels", type: "symbol", source: "cafes", filter: ["!", ["has", "point_count"]], minzoom: DETAIL_ZOOM - 0.5,
          layout: {
            ...labelLayout,
            "text-field": ["get", "label"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 15, 13],
            "symbol-sort-key": ["match", ["get", "tier"], "acclaimed", 0, "recognised", 1, 2],
          },
          paint: { "text-color": ink, "text-halo-color": halo, "text-halo-width": 1.6 },
        });
        applyFilters(m, state.current, others, points);
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
        // A group zooms in to the level where it splits
        for (const [layer, source] of [["others-clusters", "others"], ["cafe-clusters", "cafes"]] as const) {
          m.on("click", layer, async (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const zoomTo = await (m.getSource(source) as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
            m.easeTo({ center: coordsOf(f), zoom: zoomTo, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400 });
          });
          m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
        }
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
    if (m?.getLayer("cafes")) applyFilters(m, { kind, tier, showUnverified }, others, points);
  }, [kind, tier, showUnverified, others, points]);

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
        <span className="inline-flex items-center gap-1.5"><span className="tier-dot" data-tier="acclaimed" />acclaimed</span>
        <span className="inline-flex items-center gap-1.5"><span className="tier-dot" data-tier="recognised" />recognised</span>
        <span className="inline-flex items-center gap-1.5"><span className="tier-dot" data-tier="independent" />independent</span>
        <span className="inline-flex items-center gap-1.5"><span className="tier-dot" data-tier="multibranch" />multi-branch</span>
        <span>bigger circle = more cafés</span>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showUnverified} onChange={(e) => setShowUnverified(e.target.checked)} className="size-4 accent-[var(--primary-strong)]" />
          Show {unverified.length} unverified OSM cafés
        </label>
        <span className="ml-auto font-mono text-xs" aria-live="polite">{nSpecialty + nOthers} cafés on the map</span>
      </div>
      <div
        ref={box}
        className="h-[min(70dvh,640px)] min-h-[380px] overflow-hidden rounded-2xl border border-border bg-card"
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

function applyFilters(m: MapLibreMap, s: { kind: Kind; tier: TierFilter; showUnverified: boolean }, others: OtherPoint[], points: MapPoint[]) {
  const specialtyOn = s.kind === "all" || s.kind === "specialty";
  for (const id of ["cafes", "cafe-labels", "cafe-clusters"]) m.setLayoutProperty(id, "visibility", specialtyOn ? "visible" : "none");
  // Groups are computed from the source data, so the tier filter swaps the data too
  const byTier = s.tier === "all" || s.kind !== "specialty" ? points : points.filter((p) => p.tier === s.tier);
  (m.getSource("cafes") as GeoJSONSource).setData({ type: "FeatureCollection", features: groupByPlace(byTier) });
  // Clusters are computed from the source data, so the kind filter swaps the data rather than filtering layers
  (m.getSource("others") as GeoJSONSource).setData(othersData(others, s.kind));
  m.setLayoutProperty("unverified", "visibility", s.showUnverified ? "visible" : "none");
}
