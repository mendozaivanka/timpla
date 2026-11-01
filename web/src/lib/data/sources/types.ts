/**
 * What a data source has to provide. Return plain data in the shapes of `../schemas.ts`; the data layer
 * validates it, so a source can be a thin wrapper over files, a database query or an API call.
 *
 * Every method runs at build time for static pages (and per request only for pages that opt out of
 * prerendering, which needs a server adapter; see DEPLOY_ADAPTER in astro.config.mjs).
 */
export interface DataSource {
  /** Shown in build errors, e.g. "local" or "postgres". */
  name: string;


  timpla: {
    shops(): Promise<unknown>;
    independents(): Promise<unknown>;
    points(): Promise<unknown>;
    meta(): Promise<unknown>;
    timeline(): Promise<unknown>;
    provenance(): Promise<unknown>;
    ncr(): Promise<unknown>;
    osmLayer(): Promise<unknown>;
  };

  tanim: {
    provinces(): Promise<unknown>;
    national(): Promise<unknown>;
    imports(): Promise<unknown>;
    reported(): Promise<unknown>;
    meta(): Promise<unknown>;
  };
}
