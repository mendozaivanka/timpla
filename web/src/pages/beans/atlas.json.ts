/** The atlas island's data: every province's series plus the national row, in one cacheable file. */
import type { APIRoute } from "astro";
import { getTanimMeta, getTanimNational, getTanimProvinces, getTanimReported } from "@/lib/data";

export const GET: APIRoute = async () => {
  const [provinces, national, reported, meta] = await Promise.all([getTanimProvinces(), getTanimNational(), getTanimReported(), getTanimMeta()]);
  const body = { years: meta.years.filter((y) => y <= meta.latestYear), latest: meta.latestYear, box: meta.box, national: { production: national.production, cpi: national.cpi, fies: national.fies }, provinces, reported };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
};
