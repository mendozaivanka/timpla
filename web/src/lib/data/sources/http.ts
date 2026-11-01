/**
 * Reads the same content from any JSON API: a headless CMS, Supabase/PostgREST behind a view, a small
 * server in front of a database, or static JSON on a bucket. Enable with DATA_SOURCE=http.
 *
 *   GET {DATA_API_URL}/timpla/shops         → Shop[]        (and /timpla/independents, /points, /meta,
 *                                                            /timeline, /provenance, /ncr, /osm-layer)
 *   GET {DATA_API_URL}/tanim/provinces      → TanimProvince[] (and /tanim/national, /imports, /reported, /meta)
 *
 * If DATA_API_TOKEN is set it's sent as `Authorization: Bearer …`. Responses are validated like local data.
 */
import { DATA_API_URL, DATA_API_TOKEN } from "astro:env/server";
import type { DataSource } from "./types";

async function get(path: string): Promise<unknown> {
  if (!DATA_API_URL) throw new Error("DATA_SOURCE=http needs DATA_API_URL (see .env.example)");
  const url = `${DATA_API_URL.replace(/\/$/, "")}/${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...(DATA_API_TOKEN ? { Authorization: `Bearer ${DATA_API_TOKEN}` } : {}) },
  }).catch((e) => {
    throw new Error(`GET ${url} failed (${e.cause?.code ?? e.message}). Is DATA_API_URL right and the API up?`);
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return res.json();
}

export const http: DataSource = {
  name: "http",
  timpla: {
    shops: () => get("timpla/shops"),
    independents: () => get("timpla/independents"),
    points: () => get("timpla/points"),
    meta: () => get("timpla/meta"),
    timeline: () => get("timpla/timeline"),
    provenance: () => get("timpla/provenance"),
    ncr: () => get("timpla/ncr"),
    osmLayer: () => get("timpla/osm-layer"),
  },
  tanim: {
    provinces: () => get("tanim/provinces"),
    national: () => get("tanim/national"),
    imports: () => get("tanim/imports"),
    reported: () => get("tanim/reported"),
    meta: () => get("tanim/meta"),
  },
};
