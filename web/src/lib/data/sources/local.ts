/**
 * The default source: the JSON in src/data/timpla/ and src/data/tanim/, unpacked from the pinned data release by
 * `npm run data:pull` (../scripts/data-pull.sh). Never edit it by hand: change the pipeline and cut a new release.
 */
import type { DataSource } from "./types";

const json = (load: () => Promise<{ default: unknown }>) => async () => (await load()).default;

export const local: DataSource = {
  name: "local",
  timpla: {
    shops: json(() => import("@/data/timpla/shops.json")),
    independents: json(() => import("@/data/timpla/directory.json")),
    points: json(() => import("@/data/timpla/points.json")),
    meta: json(() => import("@/data/timpla/meta.json")),
    timeline: json(() => import("@/data/timpla/timeline.json")),
    provenance: json(() => import("@/data/timpla/provenance.json")),
    ncr: json(() => import("@/data/timpla/ncr.json")),
    osmLayer: json(() => import("@/data/timpla/osm_layer.json")),
  },
  tanim: {
    provinces: json(() => import("@/data/tanim/provinces.json")),
    national: json(() => import("@/data/tanim/national.json")),
    imports: json(() => import("@/data/tanim/imports.json")),
    reported: json(() => import("@/data/tanim/reported.json")),
    meta: json(() => import("@/data/tanim/meta.json")),
  },
};
