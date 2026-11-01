# Timpla (Metro Manila's independent cafés, and Philippine coffee from farm to cup)

**Live:** https://mendozaivanka.github.io/timpla/ · **Status (2026-11-01):** moved into its own repo; data v1 published
· **Data:** [latest.json](https://mendozaivanka.github.io/timpla/data/latest.json) · [releases](https://github.com/mendozaivanka/timpla/releases)

Timpla maps 329 independent cafés in Metro Manila, 108 of them specialty, with a receipt for each specialty café: who
roasts for whom, where the beans grow and when it opened. Its Beans and Shipped-in chapters count the Philippines'
coffee province by province from Philippine Statistics Authority data, and where imported coffee comes from. No star
ratings: Google and Foursquare terms forbid storing them, and every figure here links to its source.

## Layout

| Path | What |
| --- | --- |
| `web/` | The site: Astro 7, React islands, MapLibre, Nordic Rose (vendored), with maps drawn in the same minimal style as Sinturon. Served at `/timpla/` |
| `pipeline/cafes/` | Café inputs: hand-curated lists in `data/*.psv`, OSM and Overture snapshots in `sources/`, Python rules in `scripts/` |
| `pipeline/beans/` | PSA OpenSTAT pulls in `raw/`, the fetcher in `scripts/fetch_psa.py`, reported facts in `data/reported.csv` |
| `pipeline/node/` | Turn the inputs into the read models the site reads (`build-timpla-data.ts`, `build-tanim-data.ts`) |
| `pipeline/build.sh` | Builds one data version into `pipeline/build/v<N>/` with a `manifest.json` |
| `scripts/` | `release-data.sh` (publish `data-v<N>`), `data-pin.sh`, `data-pull.sh` (fetch the pinned release for the site), `check-attribution.sh` |
| `data.lock.json` | The data version the site is pinned to, with its sha256 |
| `docs/` | `DECISIONS.md`, `LICENCES.md`, `PIPELINE.md`; `history/` keeps the planning notes |
| `.github/workflows/` | `ci.yml`, `deploy.yml`, `data.yml` (monthly data run) |

## How the data flows

```
pipeline inputs (git) ──build.sh──▶ pipeline/build/v<N>/ ──release-data.sh──▶ GitHub Release data-v<N>
                                                                                    │ pinned in data.lock.json
                                                     site build ◀──data-pull.sh─────┘ (sha256-checked)
```

- **Automatic:** on the 2nd of every month `data.yml` refetches the PSA tables, rebuilds everything, checks that the
  site builds on the result, and if anything changed publishes `data-v<N+1>` and opens an "Adopt data" pull request.
  Merging it deploys the new data.
- **Hand-curated:** café lists, timeline, roaster links, awards and exclusions in `pipeline/cafes/data/` change only by
  pull request. CI rebuilds the data from the branch and reports what changed against the pinned release.
- **Snapshots, refreshed by hand for now:** the OSM and Overture files in `pipeline/cafes/sources/` (see `docs/PIPELINE.md`).

## Run it locally

Node 24, npm and [uv](https://docs.astral.sh/uv/).

```sh
git config core.hooksPath .githooks        # once: blocks AI attribution lines in commit messages
scripts/data-pull.sh                       # fetch the pinned data release
cd web && npm install && npm run dev       # http://localhost:4321/timpla/
```

Rebuild the data yourself: `pipeline/build.sh 0 && cp -R pipeline/build/v0 pipeline/build/v1 && scripts/data-pull.sh --local`.

## Cut a data release

Usually the monthly run does it. By hand: Actions → Data → Run workflow. Locally: `pipeline/build.sh <N>`, then
`scripts/release-data.sh <N>` (needs `gh auth login`), commit `data.lock.json`. Roll back by pinning an older version:
`scripts/data-pin.sh <N> <sha256 from that release's SHA256SUMS>`. Releases are never edited or deleted.

## Design system

Nordic Rose, from the private `mendozaivanka/nordic-rose` repo, vendored into `web/`: `npm run design:sync` (needs
`../nordic-rose`) and `npm run design:verify` (hash check, runs in CI). Timpla's palette and receipt styles live in
`web/src/styles/global.css`.

## Free-tier catches

- GitHub Pages needs a public repo; 1 GB per site, soft 100 GB/month bandwidth, 10 minutes per deploy.
- Scheduled workflows stop after 60 days with no repository activity. Merging the monthly "Adopt data" PR counts;
  GitHub emails before disabling, and Actions → Data → Enable workflow turns it back on.
- Overpass (OSM) asks for fair use (about 10,000 requests a day); the pipeline makes one query per refresh.
- PSA OpenSTAT is keyless but table ids drift between releases; the fetcher finds tables by title.

## Licence

Code MIT. Café directory files derived from OpenStreetMap: ODbL (© OpenStreetMap contributors). PSA figures:
Philippine Statistics Authority. Hand-curated lists: CC BY 4.0, each row citing its source. Details in `docs/LICENCES.md`.
