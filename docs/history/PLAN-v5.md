# PLAN-v5.md: Tanim on definite data only (no model)

Status: plan only, nothing built. Written 2026-10-24. **Decision (user, 2026-10-24): report only on definite data.** This supersedes PLAN-v4's municipal allocation model, intervals, tiers and what-if. Everything else in PLAN-v4 (the app shell, versioned read models, plain-language sentences, the fine-print page, the imports ledger, PLAN-v3's data contract and palette) stays.

## 1. What changes

| PLAN-v4 | PLAN-v5 |
|---|---|
| 1,642 cities and municipalities, each with a modelled share | 82 provinces (plus regions and the country), each with PSA's own figures |
| Four kinds of number: counted, estimated, reported, imagined | Two kinds: **counted** (PSA) and **reported** (a figure someone else published, with its link and date) |
| Earth Engine coffee layer, covariates, allocation, backtests, parity | None. No satellite layer, no fitting, no gates |
| What-if sliders | None. Nothing on the site is hypothetical |
| Stripes for range width | None. PSA publishes no intervals for these series; the fine print says so |
| Preview fills "spread by land area" | Gone. Every fill is a PSA number |

What "comprehensive" now means: breadth and time, not resolution. Every province x every year 2010–2025 x four varieties x five measures (production, area planted, bearing trees, yield, farmgate price), the national supply utilization account 1990–2022, imports by origin and product form 2016–2025, and the reported facts ledger. All of it from the same free, keyless PSA API, all of it versioned and attributed.

## 2. Definite data, verified

| Series | Table | Unit | Years | Breakdown |
|---|---|---|---|---|
| Production | `2E/CS/0072E4EVCP1` | tonnes green coffee | 2010–2026 (quarterly, semestral, annual) | region, province; all, Arabica, Excelsa, Liberica, Robusta, others |
| Area planted/harvested | `2E/CS/0092E4EAHM1` | hectares | 2010–2026 | same |
| Bearing trees | `2E/CS/0122E4EBTM1` | trees | 2010–2026 | same |
| Yield | derived: production ÷ area, printed as a derivation | t/ha | 2010–2026 | same |
| Farmgate price | `2M/NFG/0032M4AFN08` | PHP/kg | 2010–2026 monthly | province; Arabica, Excelsa, Liberica, Robusta |
| Supply utilization | `2B/AA/SU/0062B5ESUA5` | tonnes | 1990–2022 | national: production, imports, exports, net supply, per capita |
| Imports by origin | `2L/IMT/AVI/<year>` | CIF USD, kg | 2016–2025 | tariff line x country |
| Boundaries | faeldon 2023 provdists (MIT) | | PSGC 2023 | 82 provinces, NCR districts, City of Davao merged into Davao del Sur |

Reported facts (kind 2), hand-compiled with URL and date: PCQC winners by town and year; LGU and news hectare figures (Amadeo, Sultan Kudarat towns, Kalinga); BSWM municipal "existing coffee" hectares where a PDF has been read (Benguet verified). They appear as lines in a province's receipt, never as fills.

Known gaps, printed on the fine print page: PSA counts coffee by province, not by town, so there is no town map; the dried-berry series stops in 2022; BARMM, NIR and the Maguindanao split change the geography from 2023; farmgate zeros mean "no quotation".

## 3. The product, trimmed

Pages: **Map** (province choropleth, year 2010–2025, measure chips, variety chips, province receipt panel), **Shipped in** (unchanged from PLAN-v3 A), **Tour** (six coffee provinces, or six reported towns shown as pins with their reported fact), **The fine print**.

Province receipt panel: masthead (province, region, year); line items for the five measures by variety; "Read aloud" in Filipino then English; "The country, divided" bar (this province's share of national production, counted); year strips for production and farmgate price; "Someone said" reported lines with links; "All years" table; link to Timpla roasters listing the province.

Read models: `manifest.json`, `index.json` (provinces, regions), `prov/<psgc>.json` (every measure x variety x year, plus reported lines), `national.json` (SUA, totals), `imports/<year>.json`, `tiles` as one 80 KB TopoJSON (no PMTiles needed for 82 polygons). No `whatif/`, no `metrics.json`.

Plain sentences, two rules fewer: a share becomes the nearest saying; a change is a change when PSA's number moved (there is no range to compare against, and the sentence says the figure is a survey estimate without a published margin).

## 4. Fool-proofing kept from PLAN-v3/v4

Rules 1–13 (PLAN-v3) and 15, 16, 18, 21, 22, 23 (PLAN-v4). Dropped: 14, 17, 19, 20, 24 (they concerned the model, the satellite layer and tiles).

## 5. Effort

Three to four weekends after PLAN-v3's foundation: the shell and province map (1), the receipt panel and sentences (2), the imports page and fine print (3), tour and polish (4). No Earth Engine account, no accuracy sample, no parity test.

## 6. More definite series to add (researched 2026-10-25, all verified by API metadata or file)

| # | Series | Table / source | Unit, geography, years | Where it goes | Catch |
|---|---|---|---|---|---|
| 1 | CPI sub-index "Coffee and coffee substitutes" | `2M/PI/CPI/2018NEW/0012M4ACP22`, commodity code 67 | index (2018=100), 138 provinces and HUCs, monthly Jan 2018–Sep 2026 (2025 ave: Philippines 124.49, Benguet 120.38, Sultan Kudarat 141.23) | province receipt: "what a cup costs here vs 2018"; measure chip "coffee prices" | 2012-based back-series 2012–2021 is a different basket (`2M/PI/CPI/2012/0012M4ACPI1`, code 01.2.1); never splice |
| 2 | Family spending share on coffee and substitutes | FIES 2023 `1E/IE/0071E3ATME0`, group code 12 | % of family expenditure, 138 provinces/HUCs x income decile (Philippines 0.90 %, 1st decile 1.40 %) | province receipt: "households here spend x % on coffee"; the decile split as a small strip | one survey year; the peso base is the "Total Family Expenditure" row |
| 3 | Value of coffee production | national `2B/AA/VP/NA/0012B5EVOP1` (code 13), regional `2B/AA/VP/RE/00x2B5EVPxx` | million pesos, current and constant 2018 prices, 2000–2026 national, 2000–2025 regional (2025: 11,081.56 M vs 6,097.40 M in 2024) | a national "The country" receipt and the region line of the province receipt | no provincial line exists |
| 4 | Self-sufficiency ratio and import dependency ratio | `2B/AA/AFIS/0022E5ESSR0` (code 2) 1988–2025; `0032E5EIDR0` 1990–2022 | % (SSR 2025 47.4 %, 1988 122.4 %; IDR 2022 61.9 %) | national receipt, next to the SUA; fine print prints the formula | PSA-derived ratios from counts, label "derived by PSA"; printed AIS PDFs carry older revised values |
| 5 | Costs and returns of coffee farming | `2B/AA/CR/0072B5ECOP5` (items 22–30) | pesos per hectare and per kg, yield kg/ha, national, 1997–2021 (net returns −3,077 in 2020, −7,140 in 2021) | national receipt: "did coffee pay?" | stops in 2021 |
| 6 | Productive coffee trees, census | `2E/AFC/0402E6CPER0` (crop code 2) | millions of trees by region, 1960, 1971, 1980, 1991, 2002 (22.6 M → 111.3 M → 61.6 M) | the long view strip on the national receipt | ARMM 2002 is a coverage break |
| 7 | Farm denominators, 2022 census | `0832E6CFNA0` farms, `0862E6CFML0` parcels by land use, `0762E6CAOT0` operators | counts and hectares by province/HUC | province receipt context line ("of x farms in the province") | not coffee-specific |
| 8 | FAOSTAT green coffee history | QCL bulk zip (keyless), OWID CSV (CC BY) | tonnes, national, 1961–2024 | national receipt back to 1961 | use A-flag years only; 2022 is imputed, 2023–2024 estimated: excluded |
| 9 | Exports by destination; monthly import seasonality | `2L/IMT/AVE` (2012–2025), `2L/IMT/CIF`, `GKI`, `QPI` (2013–2026) | USD and kg by month and partner | Shipped-in page | commodity dimension not queryable through the API; web-UI download only |
| 10 | DTI suggested retail price ceilings for 3-in-1 coffee | DTI SRP bulletins 2018–2025 | pesos per sachet, national | reported line (kind 2) on the national receipt | hand-compiled from PDFs |

Confirmed absent (do not look again): coffee rows in PSA retail prices, producer price index, food-security tables, food consumption survey, farm-to-retail gap, agricultural wages, LFS; Kape Isla licensees, BPI nursery list, RSBSA/ACPC/PhilMech coffee counts (FOI only); PCQC complete results (partial press lists only); ICO history (members-only). Rejected as estimates: FAOSTAT/OWID 2022–2024, Statista and Euromonitor per-capita figures, DA roadmap targets.

Product change: add a **national receipt** page ("The country") for series 3–6, 8 and 10, and two lines to every province receipt (CPI coffee sub-index vs 2018, FIES coffee spending share).
