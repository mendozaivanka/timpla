/**
 * The data layer: the only place pages get content from.
 *
 *   const shops = await getShops();
 *
 * Which source answers is set by DATA_SOURCE (default "local" = the files in src/data/). To connect a
 * database or CMS, add a file in ./sources that implements `DataSource`, register it in SOURCES below
 * and in the DATA_SOURCE enum in astro.config.mjs, then set DATA_SOURCE. Pages don't change.
 *
 * Every result is validated against ./schemas.ts and cached for the rest of the build.
 */
import { DATA_SOURCE } from "astro:env/server";
import type { z } from "astro/zod";
import type { DataSource } from "./sources/types";
import { local } from "./sources/local";
import { http } from "./sources/http";
import {
  independentSchema, ncrSchema, osmLayerSchema, pointSchema, provenanceSchema, shopSchema,
  timelineSchema, timplaMetaSchema, 
  tanimProvinceSchema, tanimNationalSchema, tanimImportsSchema, tanimReportedSchema, tanimMetaSchema,
} from "./schemas";

const SOURCES: Record<string, DataSource> = { local, http };

const source = SOURCES[DATA_SOURCE];
if (!source) throw new Error(`DATA_SOURCE="${DATA_SOURCE}" isn't registered in src/lib/data/index.ts`);

const cache = new Map<string, Promise<unknown>>();

/** Load once, validate, and explain failures in terms of the content, not the stack trace. */
function load<S extends z.ZodType>(key: string, schema: S, fetcher: () => Promise<unknown>): Promise<z.infer<S>> {
  if (!cache.has(key)) {
    cache.set(key, fetcher().then((raw) => {
      const parsed = schema.safeParse(raw);
      if (parsed.success) return parsed.data;
      const issues = parsed.error.issues
        .slice(0, 8)
        .map((i) => `  • ${key}${describePath(raw, i.path)}: ${i.message}`)
        .join("\n");
      throw new Error(`Invalid ${key} from the "${source.name}" data source:\n${issues}`);
    }));
  }
  return cache.get(key) as Promise<z.infer<S>>;
}

/** projects.0.tint → projects[0] "Anomaly Detection & Reporting".tint, so the bad entry is easy to find. */
function describePath(raw: unknown, path: PropertyKey[]) {
  let out = "", node: any = raw;
  for (const k of path) {
    node = node?.[k as any];
    const label = typeof k === "number" ? (node?.title ?? node?.name ?? node?.slug ?? node?.company) : undefined;
    out += typeof k === "number" ? `[${k}]${label ? ` "${label}"` : ""}` : `.${String(k)}`;
  }
  return out;
}

export const dataSourceName = source.name;

// ───────── Timpla ─────────
const t = source.timpla;
export const getShops = () => load("timpla.shops", shopSchema.array(), t.shops);
export const getIndependents = () => load("timpla.independents", independentSchema.array(), t.independents);
export const getPoints = () => load("timpla.points", pointSchema.array(), t.points);
export const getTimplaMeta = () => load("timpla.meta", timplaMetaSchema, t.meta);
export const getTimeline = () => load("timpla.timeline", timelineSchema, t.timeline);
export const getProvenance = () => load("timpla.provenance", provenanceSchema, t.provenance);
export const getNcr = () => load("timpla.ncr", ncrSchema, t.ncr);
export const getOsmLayer = () => load("timpla.osmLayer", osmLayerSchema, t.osmLayer);

// ───────── Tanim ─────────
const n = source.tanim;
export const getTanimProvinces = () => load("tanim.provinces", tanimProvinceSchema.array(), n.provinces);
export const getTanimNational = () => load("tanim.national", tanimNationalSchema, n.national);
export const getTanimImports = () => load("tanim.imports", tanimImportsSchema, n.imports);
export const getTanimReported = () => load("tanim.reported", tanimReportedSchema, n.reported);
export const getTanimMeta = () => load("tanim.meta", tanimMetaSchema, n.meta);
