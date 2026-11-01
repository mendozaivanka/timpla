# Decisions

Append-only. Newest last.

- **2026-10-21 · Inclusion rules.** A café is listed if it is inside Metro Manila (point in polygon), specialty, and
  open in 2025–26. Recognition (acclaimed, recognised, indie) is a tier, not a filter. Google and Foursquare ratings are
  never stored: their terms forbid it.
- **2026-10-22 · The wider directory.** Timpla lists every independent café with recent open evidence; specialty is a
  badge. Chain = curated list or 10+ NCR locations; 4–9 = multi-branch, kept. OSM-only rows with no evidence are a
  faint "unverified" map layer.
- **2026-10-24 · Definite data only** for the coffee chapters: PSA counts and reported facts with links, no model.
- **2026-10-25 · Tanim folded into Timpla** as the Beans and Shipped-in chapters.
- **2026-11-01 · Own repo, releases, Nordic Rose.** Timpla moved out of the portfolio repo into `mendozaivanka/timpla`
  (fresh history; the old repo keeps the earlier history). Data reaches the site as GitHub Releases `data-v<N>`
  pinned by `data.lock.json` and sha256-checked at deploy. v1 reproduces the last Render build exactly (only
  `builtAt` differs). The site uses the Nordic Rose design system with Timpla's Kape't Gatas palette on top; the old
  star mark became a cup mark.
- **2026-11-01 · Inputs stay in git for v1.** OSM, Overture and PSA snapshots are committed under `pipeline/` so any
  build is reproducible from the repo. The monthly run refreshes PSA automatically; OSM and Overture refreshes are
  manual until their dated filenames are parameterised.
- **2026-11-01 · Schemas live in the site.** The zod schemas in `web/src/lib/data/schemas.ts` are the data contract;
  the data run validates a new version by building the site on it. A separate `contracts/` package can come later if a
  second consumer appears (Sinturon's Barako chapter reads Timpla's release).
