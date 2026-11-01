# PLAN-v4.md: "Tanim", a comprehensive coffee atlas for every Philippine municipality

Status: plan only, nothing built. Written 2026-10-24. Supersedes the scope of `PLAN-v3.md` (the three Timpla "beans" designs) with a standalone product in the mould of Lights (lights.krtmtthw.dev, Kurt Matthew Nudo's municipal poverty map): every city and municipality on one map, one honestly-labelled value per place and year, intervals and reliability tiers, plain-language readings, published backtests, an in-browser what-if, versioned read models with provenance, and an about-and-method page. Everything PLAN-v3 verified about PSA OpenSTAT, the import tables, the palette and the chart forms still holds and is reused. New verification is in `research_notes/Coffee bean open data viz projects/ph_municipal_feasibility.md`. **VERIFIED** / **ASSUMED** as before.

Working name: **Tanim** (Filipino: a planted crop). Alternatives: Puno, Kapehan. The site is its own app (Astro + React islands + MapLibre), linked from Timpla's "Beans" section, not a Timpla page, because its shell (map, panel, year control, version footer) is a different product from a receipt-styled directory.

---

## 0. What "comprehensive like Lights" means, trait by trait, and what coffee can honestly match

| Lights trait | Lights has | Tanim can honestly have | Why the difference |
|---|---|---|---|
| Full-nation coverage | 1,642 LGUs, one value each, 2012–2025 | 1,642 LGUs, one value each, 2010–2025 | Same boundaries (faeldon 2023 / HDX COD-AB) **VERIFIED** |
| Official vs model | PSA small-area estimates in round years; model between | PSA official exists only at **province** level (82 provinces, yearly). Every municipal value is modelled: a share of the province total | No municipality x coffee statistic exists anywhere in PSA, the DA roadmap or the Census of Agriculture **VERIFIED** |
| Backtests | Per-LGU error against PSA rounds | Province-level only: leave-one-province-out and temporal holdout of the allocation model, against PSA province totals; plus a hand-made accuracy check of the satellite coffee mask | Nothing municipal to score against **VERIFIED** |
| Intervals and tiers | Conformal 50/90% per LGU | Bootstrap-over-provinces spread x satellite-threshold sweep (0.25–0.45), shown wide, tiers by relative width | Honest proxy; cannot be validated at municipal level |
| What-if | Night-light growth, NDVI sliders | Detection threshold of the coffee mask; warming (+0.5 to +2 °C) through the suitability covariate; province total override | Only inputs the model really uses **ASSUMED** |
| Plain words | "about 1 in 4 people" | "about 1 hectare in 20 of this town's farmland", "a fifth of the province's coffee", "range is wide: treat as a rough share" | Same template approach |
| Provenance | manifest, data version, git sha | Same, plus PSA table ids and "updated" stamps | Same |
| Languages | EN / JA | EN / Filipino ("Sa simpleng salita") | Audience |

The honest claim, printed on the About page and in every panel: *Province coffee area and production are PSA figures. Municipal values are a modelled allocation of the province total using a satellite coffee-presence layer and climate and terrain covariates. The allocation was backtested at province level only; no municipal coffee statistics exist to check it against.*

What Tanim does **not** claim: a validated municipal production number, a municipal trend, or a municipal interval that has been checked against truth.

---

## 1. Data stack (all free; catches named)

| Layer | Source | Access | Licence | Catch |
|---|---|---|---|---|
| Province truth, 2010–2026 | PSA OpenSTAT `2E/CS`: production `0072E4EVCP1`, area `0092E4EAHM1`, bearing trees `0122E4EBTM1` (by variety) | PxWeb POST, no key, CORS | PSA, attribute | Table-ID drift, names not codes, 1,000-cell calls **VERIFIED** |
| Imports by origin, 2016–2025 | PSA OpenSTAT `2L/IMT/AVI` (`0012L4DMFD4` = 2025) | PxWeb, two-step positional recipe | PSA | Build-time only **VERIFIED** |
| Allocation weight | Forest Data Partnership **coffee probability 2026a**, 10 m, 2018–2024, GEE asset `projects/forestdatapartnership/assets/coffee/model_2026a` | Earth Engine zonal sums per municipality at thresholds 0.25/0.33/0.45 | CC BY 4.0 | Philippines absent from its training labels; confuses tea, banana, multi-canopy; authors say accuracies are overestimates; GEE non-commercial tier only **VERIFIED** |
| Covariates | TerraClimate (CC0), Copernicus DEM GLO30 / SRTM, ESA WorldCover v200 (CC BY), Dynamic World (CC BY), MODIS MOD13Q1, VIIRS annual, GHSL population | GEE zonal stats per municipality | as listed | 150 EECU-h/month Community tier (plenty for 1,642 polygons x a dozen reducers) **VERIFIED** |
| Municipal denominator | PSA Census of Agriculture 2012 farms per municipality `0332E6CNAF1` (1,627 rows) | PxWeb | PSA | 2012 only; 2022 CAF stops at province **VERIFIED** |
| Boundaries | faeldon 2023 TopoJSON (MIT; lowres 0.65 MB, medres 1.75 MB); HDX COD-AB ADM3 (CC BY-IGO) for the crosswalk | GitHub / HDX | MIT / CC BY-IGO | 1,642 LGUs mid-2024; 8 new BARMM municipalities (2024) and the Maguindanao split need a crosswalk table **VERIFIED** |
| Spot checks | News and LGU figures (Amadeo 4,790 ha 2019; SOCCSKSARGEN 26,179 ha 2022, 79% Sultan Kudarat; Kalinga 3,427 ha 2014; CAR 5,162 ha 2022) and PCQC winner towns | hand-compiled CSV with URLs | n/a | Undated or old; shown as "reported", never as truth |
| Optional prior | MapSPAM 2020 v2.2 (10 km, arabica/robusta) | Harvard Dataverse | unstated | Guestbook-gated download; coarse **VERIFIED** |
| Optional partial truth | BSWM provincial suitability PDFs with municipal "existing coffee ha" tables (Benguet verified: 396 ha total; Atok 66, Buguias 64...) | manual PDF scraping | CC BY vs CC BY-NC-SA inconsistent | c.2017 inventory that undercounts PSA badly; 20–30 provinces at best **PARTLY VERIFIED** |

Not used: ICO, OEC, FAOSTAT API (auth), psa.gov.ph PDFs (Cloudflare), Grüter 2022 rasters (Figshare unreachable this session; retry by hand).

---

## 2. The product

### 2.1 Pages

1. **Map** (`/`): the app. Year control 2010–2025 (every year is a PSA province year, so the control marks which years have the *satellite* layer, 2018–2024, versus years where the allocation reuses the nearest mask year). Province picker, LGU search, municipal choropleth, legend with plain names, three-step "How to read this map" guide, detail panel.
2. **Shipped in** (`/imports/`): the origin-to-form ledger from PLAN-v3 design A (Sankey, unit values, table), 2016–2025, with the same year control.
3. **About & method** (`/about/`): "Honest about the data": official vs modelled, how good is the allocation (province backtest table), how the plain sentences are made, sources and licences, the data flow diagram, version history.
4. **Tour** (`/tour/`): six coffee towns in 2025, each with its figure and source (Atok and Buguias in Benguet; Senator Ninoy Aquino and Lebak in Sultan Kudarat; Amadeo in Cavite; Maramag or Impasug-ong in Bukidnon), as cards that deep-link into the map. Also the embed target.

### 2.2 Read-model contract (one immutable folder per data version, `data/v1/`)

| File | Content |
|---|---|
| `latest.json` | `{"version":"v1","base":"v1/"}`, flipped only when a version is complete |
| `manifest.json` | version, generated_at, git sha, years, mask years, breaks, tier thresholds, model name and version, what-if widening, counts, provenance: PSA table ids and their `updated` stamps, GEE asset ids, boundary vintage, crosswalk hash |
| `index.json` | LGUs (`p` pcode, `n` name, `pv` province, `r` region, `c` class, `x`,`y`), provinces (bbox, PSA label), regions |
| `prov/<pcode>.json` | per year and variety: PSA area, production, bearing trees, farmgate price; plus the backtest residual for that province |
| `lgu/<pcode>.json` | per year: `model` (area index ha, share of province, 50/90% range, tier, mask ha at three thresholds, mask year used), `inputs` (elevation band, mean temperature, rainfall, tree cover, 2012 farm area), `reported` spot checks with URLs, `shown` (what the map draws and why) |
| `metrics.json` | the backtest leaderboard: LOPO MAE by province, temporal holdout, baselines (area-only, farms-only, MapSPAM prior), threshold sensitivity, mask accuracy check |
| `tiles/` | PMTiles archive with layers `lgu` and `prov` (geometry + pcode only) and `tiles-attrs.csv` (`v10…v25` value, `t10…t25` tier) so a new data version never rebuilds tiles |
| `imports/<year>.json` | the tidy origin x form table from PLAN-v3 |
| `whatif/model.json` | the allocation coefficients and the per-LGU feature row, so the browser recomputes a scenario with no server |
| `estimates.csv` | the long table, also attached to the GitHub release |

### 2.3 Honesty rules (one module, read by map, legend, table, chart and sentences)

- Fixed class breaks for the municipal area index, the same in every year, map, legend and table: 0 (none detected), under 50 ha, 50–200, 200–1,000, 1,000+ (ASSUMED; set from the first run's distribution and then frozen).
- Province fills are **official** (opaque, PSA); municipal fills are **modelled** (lighter, 0.55 opacity), exactly Lights' convention. Tiers by relative 90% width: solid (under 25%), moderate (25–50%, sparse hatch), wide (over 50%, dense hatch). ASSUMED thresholds.
- Source badge in every panel: "PSA official (province)" or "Modelled share (municipality)". A modelled number is never styled like an official one in any view.
- "Reported" facts (news, LGU posts) get a third badge and sit under the model, never in the map.
- Years without a satellite mask year say which mask year was reused.

### 2.4 The detail panel (right aside, 460 px desktop; bottom sheet on phones)

1. Name, class, province, region; Simple / Detailed toggle; close.
2. Headline: `≈ 1,340 ha` with `Modelled share (2025)` badge, 90% range, tier chip; Detailed adds mask hectares at the three thresholds and the share of the province.
3. **Sa simpleng salita / In plain words**: headline sentence, why it is modelled, comparison with the province and the country, whether the change since last year is bigger than the range, "Copy a plain summary".
4. Series chart 2010–2025: province PSA line (solid, official) on one axis as share-of-province context is *not* allowed (two scales); instead two stacked panels: the municipality's modelled hectares with 50/90% bands (dashed), and the province's PSA hectares (solid). Backtest years show the model's LOPO value as a hollow marker on the province panel.
5. Farm picture: a 100-cell grid of the town's 2012 farmland, cells filled up to the lower limit (dark), the estimate (mid), the upper limit (light): the "1 in 20 hectares" picture.
6. **Hypothetical scenario** (dashed border, "Hypothetical" badge): sliders for mask threshold (0.25–0.45), warming (+0 to +2 °C), province total (−30% to +30%); result sentence with the widened range; Reset.
7. All years (table), reported facts with links, "Open in Timpla" when a roaster lists this origin.

### 2.5 Map

MapLibre GL with OpenFreeMap basemap tinted to Kape't Gatas, PMTiles for the two polygon layers (self-hosted; Render static must serve HTTP range requests, **ASSUMED**, else fall back to per-province GeoJSON fetched on drill-down), fill colour from `tiles-attrs.csv` by year, hatch via a pattern image, province outlines above, labels from the basemap. Zoom 5–11. Hover shows name and value; click opens the panel and writes the URL (`?y=2025&prov=…&lgu=…`). Keyboard: the search field reaches every LGU.

---

## 3. Pipeline (write side, run by hand, outputs committed)

```
tanim/
  pipeline/            Python (uv): sources.yaml registry, fetch_psa.py, fetch_boundaries.py, crosswalk.py, ee_zonal.py, features.py, allocate.py, backtest.py, materialise.py
  core/                TypeScript: features.ts, allocate.ts (the allocation model, used by materialise AND the browser what-if), honesty.ts, plain.ts; parity test: Node output == Python output within 1e-9
  data/v1/             read models (committed; tiles as PMTiles via Git LFS or a GitHub release asset)
  web/                 Astro + React islands + MapLibre; pages map, imports, about, tour; embed route
```

Steps and gates:

1. `fetch_psa.py`: PLAN-v3 contract (title-resolved tables, label-resolved dimensions, cell budget, BOM, footnotes, PSGC crosswalk, checks). Writes `prov/` inputs and the import tidy table.
2. `fetch_boundaries.py`: faeldon 2023 municities per province plus HDX COD-AB tables; `crosswalk.py` builds pcode x PSA-name x 2012-CAF-code x BARMM-2024 map; gate: 1,642 rows, every PSA province label matched.
3. `ee_zonal.py` (needs a registered non-commercial Earth Engine project; credentials stay on the laptop, never in CI): per LGU, FDP coffee mask hectares at 0.25/0.33/0.45 for 2018–2024; TerraClimate mean temperature and rainfall (2010–2024), elevation and slope bands, WorldCover tree and crop fractions, Dynamic World crop fraction, VIIRS radiance, GHSL population; written to `features.parquet` with a cross-check run in a second script (exactextract on exported GeoTIFFs) for ten random LGUs.
4. `allocate.py`: for province p and year t, municipal weight `w_mt = mask_ha_mt^a · suit_mt^b · farm2012_m^c`, parameters fitted so that the *aggregate* reproduces province totals best under leave-one-province-out (non-negative least squares on log weights; Poisson alternative). Municipal estimate = province PSA area x normalised weight. Uncertainty = bootstrap over provinces x threshold sweep, 50/90% quantiles.
5. `backtest.py`: LOPO MAE and MAPE by province; temporal holdout (fit to 2018–2023, nowcast 2024–2025, compare with carry-forward of the province's 2023 municipal shares); baselines: area-only, farms-only, MapSPAM prior; threshold sensitivity; the hand-labelled mask accuracy sample (300 points, done once in the Earth Engine Code Editor against high-resolution basemaps). Written to `metrics.json` and the About table.
6. `materialise.py` → `data/vN/`; parity test between Python allocation and `core/allocate.ts`; `latest.json` flipped last.
7. Tiles: once per boundary vintage, `tippecanoe` + `pmtiles` from faeldon medres; attributes joined at runtime from CSV, never baked.

Cadence: PSA crops quarterly (annual figure settles around August), imports mid-year, FDP yearly. `npm run tanim:check` reads PSA metadata `updated` stamps and the FDP asset version and prints what is newer than the manifest.

---

## 4. Fool-proofing and future-proofing (on top of PLAN-v3's 13 rules)

14. **One model implementation.** The allocation lives in `core/allocate.ts`; Python only fits parameters and calls Node for the final numbers, so the what-if in the browser and the published numbers can never disagree (Lights' parity rule, without Rust).
15. **Immutable versions, flip last.** `data/vN/` is never edited; `latest.json` points to a complete version; rollback is a one-line flip.
16. **Breaks and tiers frozen in the manifest**, not in code, so a palette or threshold change is a data version, not a deploy.
17. **Mask year explicit** in every LGU record; a year with no satellite layer says so in the panel and the legend.
18. **Crosswalk gated**: build fails if any LGU lacks a province, any PSA province lacks LGUs, or the 2012 CAF code map leaves a gap; BARMM-2024 towns inherit their parent's 2012 denominator with a flag.
19. **Earth Engine budget guard**: the zonal script estimates EECU before running and refuses above 20 EECU-hours per run; outputs cached by (asset version, boundary hash, year).
20. **No secrets in CI**: Earth Engine runs on the laptop; CI only type-checks, tests parity, and builds the site from committed read models.
21. **Every number has three homes**: the map, the panel sentence, and the table or CSV; a screen reader and a spreadsheet user get the same values.
22. **Spot-check facts carry a URL and a date** and are rendered as "reported", never used to tune the model silently; when one disagrees with the model by more than the 90% range, the panel says so.
23. **Licence ledger** in `sources.yaml`: PSA (attribute), FDP (CC BY 4.0, cite model 2026a), TerraClimate (CC0), WorldCover and Dynamic World (CC BY), faeldon (MIT), HDX (CC BY-IGO), OpenFreeMap tiles; the About page is generated from it.
24. **Graceful map fallback**: if PMTiles range requests fail on the host, the app loads per-province GeoJSON (medres, 1.75 MB total) on demand; the home view uses the province layer only.

---

## 5. UI, in Kape't Gatas on Tala

Shell: Tala header with the star mark, nav Map · Shipped in · Tour · About, language switch EN / FIL, theme menu; footer with data version, generated date, data commit, "data as of", app commit. Map page: controls row (Year with prev/next and a mask-year strip, Province, Search), map with legend bottom-left and the guide card, right aside panel. Phone: controls stack, map 52 vh, panel as a bottom sheet with a 52 px summary bar when collapsed (Lights' pattern).

Colour: province official fills use the brown sequential ramp at 0.92 opacity; municipal modelled fills the same ramp at 0.55; hatch pattern in `--muted-foreground`; what-if in dashed `--goldink` outline; chart official line `--ink`, model dashed `--strong` with `--rosas-2` bands. All validated in PLAN-v3 §1.4.

Mock-ups: canvas "Timpla UI directions", page **Tanim: the comprehensive atlas** (four artboards: App desktop, Phone, About & method, Tour). The preview fills on the mock map spread each province's PSA 2025 area across its municipalities by land area, a naive baseline labelled as such; model numbers, backtest cells and intervals are placeholders until the first run.

---

## 6. Build order and effort

| Milestone | Weekends | Delivers |
|---|---|---|
| M0 Foundation | 1 | PLAN-v3 fetcher, crosswalk, read-model skeleton, `core/honesty.ts`, Tala shell, province-only map with official fills, panel for provinces |
| M1 Satellite layer | 2–3 | Earth Engine registration, zonal script, features parquet, mask accuracy sample (300 points by hand), threshold sweep |
| M2 Allocation and backtests | 4–5 | `allocate.py` + `core/allocate.ts` parity, LOPO and temporal backtests, `metrics.json`, intervals and tiers, municipal fills |
| M3 Panel and plain words | 6–7 | Full panel, EN/FIL sentence templates with tests, series panels, farm grid, year table, reported facts |
| M4 What-if, tour, embed | 8 | Browser scenario from `whatif/model.json`, Tour page, embed route, copy summary |
| M5 Imports and About | 9 | Shipped-in page from PLAN-v3 A, About generated from `sources.yaml` and `metrics.json`, version footer |

L overall: about nine weekends after PLAN-v3's foundation; M0–M2 are the risk, and M1's accuracy sample decides whether municipal fills ship at all. If the mask check comes back under 60% precision for the Philippines, Tanim ships as a province atlas with a "coffee detected here" presence overlay and no municipal hectares, which is still a complete, honest product.

## 7. Definition of done

- `metrics.json` published with LOPO MAE, temporal holdout and the three baselines; the About table reads from it, no hand-typed numbers.
- Parity test green: Node allocation equals Python within 1e-9 for every LGU-year.
- Every municipal number on screen carries the modelled badge, its range and its tier; the province number carries the PSA badge and table id.
- Keyboard-only walkthrough: search → panel → what-if → copy summary, with no mouse.
- Lighthouse accessibility 100 on map and about pages at 390 px and 1280 px, light and dark.
- `tanim:check` reports PSA and FDP freshness; a new PSA release becomes a new data version in under two hours by hand.
