# PLAN-v3.md: "Where the beans come from", three designs for Timpla

Status: plan only, nothing built. Written 2026-10-24 against `cafe-data/` (Timpla's data project), `tala-portfolio/` (the Astro site: `src/components/timpla/`, `src/lib/data/`, `scripts/build-timpla-data.ts`) and `tala-design/` (Tala Rosa tokens, the Kape't Gatas palette in `docs/palette-example.css`). It combines projects 1 and 2 of `reports/Coffee bean open data viz projects.md` (the province-by-variety map and the import-origin flows) into one Timpla feature, offered as three designs that share one data contract. Constraints kept throughout: free and open data only, no keys, no secrets in CI, static site on Render, Tala conventions, honest units.

Everything marked **VERIFIED** was read from the live PSA API or a cited page on 2026-10-24 (details in `research_notes/Coffee bean open data viz projects/`). **ASSUMED** means a design decision or an unconfirmed detail that must be checked before it is printed on the site.

---

## 0. The story in one line

Manila's menus say Benguet; PSA says Sultan Kudarat grows 44% of the country's coffee (15,689 of 35,646 t green beans, 2025). And the cup itself is mostly imported: 175,194 t of coffee products came in during 2025 (USD 813.6 M), Vietnam shipping the beans (73% of green imports) and Indonesia shipping the 3-in-1 (90% of preparations, 113,288 t). Both halves come from the same free, keyless PSA OpenSTAT API. **VERIFIED**

---

## 1. Shared foundation (build this once, all three designs sit on it)

### 1.1 Data sources and their catches

| Source | What | Access | Catch |
|---|---|---|---|
| PSA OpenSTAT, Crops `2E/CS` | Production (`0072E4EVCP1.px`, Crop codes 11-15 = Coffee GCB total, Arabica, Excelsa, Liberica, Robusta), area (`0092E4EAHM1.px`, codes 3-7), bearing trees (`0122E4EBTM1.px`, codes 2-6); 110 geolocations (`0` = Philippines, `..REGION`, `....Province`), years 2010-2026, Period `6` = Annual | POST JSON to `https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2E/CS/<table>.px`, no key, CORS `*` | Table IDs drift between re-issues (web UI still indexes `0062E4EVCP1`); labels are names not PSGC codes; CSV has a UTF-8 BOM; `..` = missing; `json-stat2` returns one value (bug); ~1,000 cells per call, 30 calls per 10 s (reported, a 550-cell call worked); dried-berry series discontinued after 2022 **VERIFIED** |
| PSA OpenSTAT, Imports by origin `2L/IMT/AVI` | One table per year: `0012L4DMFD4.px` (2025, updated 2026-06-25) back to `0102L4DMFC5.px` (2016); dims Commodity Code (9,895 eleven-digit tariff lines, 41 of them coffee), Country (217, ISO numeric), Year, Value (0 Quantity, 1 Gross Kilo, 2 CIF USD) | Same API | Commodity dimension comes back as positional indices, so two calls per year: `json-stat` to get labels, then `json` with the matching indices; wildcards match the index, not the code; 100,000-cell selection cap; Python `urllib` hit an SSL error on this host, `curl` and `requests` with a browser User-Agent work **VERIFIED** |
| faeldon/philippines-json-maps | Province TopoJSON (`provdists`, lowres about 138 KB), PSGC codes as of 2023-12-31, MIT | GitHub raw file, committed once | No Negros Island Region (PSA reports NIR from 2024); City of Davao and Maguindanao del Norte/Sur present; names differ from PSA labels **VERIFIED** |
| Natural Earth 1:110m countries | Origin-country outlines and ISO numeric codes, public domain | Committed once | Only needed by design B's Asia view; the Sankey needs no geometry |
| UN Comtrade preview API | Cross-check only, 1 period x 1 product per call, 2 s pacing | No key | Re-dissemination forbidden without permission: log the comparison, never publish Comtrade numbers; PSA figures are identical anyway **VERIFIED** |

Not used: ICO (PDF or paid), OEC (Pro for current data), FAOSTAT API (now needs an Authorization header), psa.gov.ph PDFs (Cloudflare-gated to scripts). **VERIFIED**

### 1.2 Pipeline (where every file lives)

```
cafe-data/scripts/fetch_psa_coffee.py        new: pulls the 4 crop/area/tree tables and the 10 import tables
cafe-data/extra/psa/manifest.json            new: resolved table IDs, titles, PSA "updated" stamps, fetch date, row counts, checks
cafe-data/extra/psa/crops_<slug>/<date>.csv  new: raw snapshots, UTF-8 (supersedes extra/psa_coffee_green_beans_by_province_2022_2025.csv, which is latin1)
cafe-data/extra/psa/imports_<year>.csv       new: tidy year x tariff line x origin x (qty, kg, usd)
cafe-data/data/psgc_crosswalk.csv            new, hand-written: PSA label -> PSGC code, aliases, notes (City of Davao, Maguindanao, NIR)
cafe-data/data/hs_groups.json                new: tariff prefix -> product form (green, roasted, extracts, preparations, other)
cafe-data/data/countries_m49.csv             new: ISO numeric -> name, region (so PSA's country labels are never printed raw)
tala-portfolio/scripts/build-timpla-data.ts  extended: derives src/data/timpla/beans.json (+ provinces.json geometry, projected once like ncr.json)
tala-portfolio/src/lib/data/schemas.ts       extended: beansSchema, provincesSchema (strict zod, build fails on drift)
tala-portfolio/src/components/timpla/beans/* new components per design (listed per design below)
tala-portfolio/src/pages/timpla/beans.astro  new page; TimplaLayout nav gains { id: "beans", label: "Beans" }
```

Run by hand: `python scripts/fetch_psa_coffee.py` in `cafe-data/`, then `npm run timpla:data` in `tala-portfolio/`, commit both. No GitHub Actions (the CLI token lacks the `workflow` scope, see `tala-design/README.md`), so add `npm run timpla:psa-check`, which only reads table metadata (`updated` field) and prints "new PSA data since <manifest date>" so you know when to refetch. PSA's observed cadence: crops tables updated 2026-08-28 (quarterly bulletins), 2025 import table 2026-06-25 (annual, mid-year). **VERIFIED dates, ASSUMED cadence**

### 1.3 Fool-proofing and future-proofing rules (the "data contract")

1. **Never hard-code a table ID.** Resolve each table from the folder listing by a title regex (`Non-Food and Industrial Crops: Volume of Production, by Region, Province`), require exactly one match, record the resolved ID in `manifest.json`. Same for the import tables: match `Annual Value of Philippine Imports by Commodity and Country of Origin, (\d{4})` and loop the captured years.
2. **Never hard-code a dimension code.** Read the metadata, pick Crop values whose label matches `Coffee` and `green coffee beans`, Period whose label is `Annual`, Year values from their labels. New years appear automatically; a renamed crop label fails the build with the list of labels it saw.
3. **Budget every call.** Compute cells before each POST (values per dimension multiplied), split by year when over 900, sleep 400 ms between calls (30 per 10 s), retry twice on 429/5xx, then fall back to the last snapshot with a loud warning.
4. **Parse defensively.** `utf-8-sig`, `..` and empty to null, strip the `..`/`....` indent prefixes and the `1/`, `2/`, `3/` footnote markers into a separate `note` column, keep `raw_label` untouched.
5. **Join by code, fail on names.** `psgc_crosswalk.csv` maps every PSA province label to a PSGC code. The build fails if any non-aggregate row is unmatched and prints the label. Special cases are explicit rules, not silent drops: City of Davao is merged into the Davao del Sur polygon (PSA splits them, the 2023 TopoJSON has both; keep a `merge_into` column); Maguindanao del Norte/Sur values before 2023 are shown on the combined polygon; NIR only matters for region-level tables, and the site uses province rows.
6. **Imports: match on labels, group by config.** Each run fetches the commodity labels via `json-stat`, selects lines whose 11-digit code starts with a prefix in `hs_groups.json` (0901.11, 0901.12 green; 0901.21, 0901.22 roasted; 2101.11 extracts; 2101.12 preparations; 0901.90 other). When HS 2028 or a new AHTN edition changes codes, only that file changes. Keep the tariff line in the tidy CSV so a future robusta/arabica split (AHTN 0901.11.20 vs .90) is a config change, not a refetch.
7. **Countries by ISO numeric.** Names come from `countries_m49.csv`; Malaysia, Singapore and Switzerland carry a `hub: true` flag so the UI can say "shipped via" rather than "grown in".
8. **Units are explicit everywhere.** Domestic production is tonnes of green coffee beans (GCB). Imports are product weight (kg) and CIF USD. The site never adds 3-in-1 kilos to green-bean kilos in one number: cross-form totals are shown in USD, weights only within a form. A green-bean-equivalent toggle is allowed only with the conversion factors printed beside it (ASSUMED: ICO factors, roasted 1.19, soluble 2.6; confirm before use).
9. **Checks that gate the build** (results also written to the manifest): national row equals the sum of region rows within 0.5% for each crop and year; province count between 80 and 95; years contiguous; HS6 totals for 2022-2025 compared with the Comtrade preview and logged (not published); every province in the crosswalk exists in the TopoJSON and vice versa.
10. **Snapshots and staleness.** Raw CSVs are committed per fetch; `beans.json` carries `retrievedAt` and PSA's `updated` per table; every figure's footer prints both; a "data may be stale" badge appears when `retrievedAt` is older than 400 days.
11. **Schema drift fails loudly.** `beansSchema` is `z.strictObject`; the existing loader in `src/lib/data/index.ts` already explains failures by path. `astro check` runs before every build.
12. **Degrade, don't break.** A chart with a missing year shows the nearest year with a caption, not an empty panel. All charts have a table view (`<details>` "Show the numbers", the existing pattern). Tooltips enhance, never gate. Keyboard focus on a province or link shows the same tooltip.
13. **Attribution.** Footer line: "Philippine Statistics Authority, OpenSTAT (Crops Production Survey; International Merchandise Trade Statistics), retrieved <date>. Boundaries: faeldon/philippines-json-maps (MIT), PSGC Dec 2023. Countries: Natural Earth." PSA's licence text could not be fetched this session; attribute and link. **ASSUMED attribution suffices**

### 1.4 Colour, validated for the Kape't Gatas palette

Form picks colour, and colour was run through the dataviz validator on the Kape surfaces (`#f7f1e9` light, `#1a1310` dark). Add these to Timpla's block in `tala-portfolio/src/styles/global.css` (project-only variables, never in Tala), with the dark block repeated under `prefers-color-scheme` as the palette example does.

| Job | Light | Dark | Validator |
|---|---|---|---|
| Sequential (choropleth tonnes, t/ha, share): one hue, light to dark | `#f4e9dc` `#e8c9a9` `#d6a77e` `#b9774c` `#8b4a26` `#3b2016` (the existing rosas-1..5 + Barako) | `#2b211b` `#4a3426` `#7a5236` `#b9774c` `#e2a47a` `#f0c9a4` | Monotone lightness, single hue (27 deg spread). For a binned legend start at `#d6a77e` so the lightest bin clears 2:1 |
| Ordinal (product forms, in processing order: green, roasted, extracts, preparations) | `#d6a77e` `#b9774c` `#8b4a26` `#3b2016` | `#7a5236` `#b9774c` `#e2a47a` `#f0c9a4` | Same ramp, four steps, direct-labelled |
| Categorical (the four varieties): `--cat-robusta` `--cat-arabica` `--cat-excelsa` `--cat-liberica` | `#9a4f22` `#1f6fa8` `#a8710f` `#7b4a8e` | `#c97a42` `#3a8fc8` `#b88a1a` `#a57cc4` | All six checks pass in both modes (worst adjacent CVD dE 19.7 light, 19.1 dark; contrast >= 3:1) |
| Emphasis / de-emphasis | `--primary-strong` for the one highlighted province or origin, `--muted-foreground` at 35% for the rest | same | n/a |

Rules carried from the dataviz method: varieties and product forms never share a figure (varieties are categorical, forms are ordinal, so no hue is reused for two meanings on one page); origin countries are never coloured by country (eight-plus series), they take the product-form colour of their link and are identified by direct label and hover; text wears text tokens, never the series colour; thin marks, 2 px surface gaps, solid hairline axes; a legend whenever there are two or more series; tabular numerals only in tables.

Why `#1f6fa8` for Arabica: it is the validated successor of Timpla's existing `--harvest` slate (`#3f6e85`), which fails the chroma floor as a categorical slot. Keep `--harvest` for the existing HarvestChart dumbbell (two series, direct-labelled, so it is legal there).

### 1.5 Chart forms, chosen by job (shared by all designs)

| Question | Form | Why not the alternative |
|---|---|---|
| Where is coffee grown, how much | Province choropleth, sequential ramp, three metrics (tonnes, t per ha, variety share) | Absolute tonnes alone is one dark province and an empty archipelago; t/ha exposes the Benguet yield artefact, which gets a caption, not a hidden error |
| Which variety where | Four small multiples (one per variety), each its own sequential fill, titled by variety | A single four-hue map fails the all-pairs rule for choropleths (cap three) |
| How shares moved since 2010 | Bump chart of regional share rank, Sultan Kudarat emphasised | A stacked area of 17 regions is unreadable |
| Who supplies which product form | Sankey origin -> form, link colour = form (ordinal), top 7 origins + Other | A chord diagram hides direction; a treemap hides the form split |
| Value vs weight | Toggle on the Sankey (CIF USD / kg), never two axes | Dual axis is the number-one chart mistake |
| What a kilo costs by origin and form | Unit-value small multiples (USD/kg lines, 2016-2025, one panel per form) | One chart with 20 lines |
| The headline | Stat tiles (hero numbers), sans face, proportional figures | A one-bar bar chart |

---

## 2. Design A: "Two ledgers" (the explorer)

**For whom.** Readers who want to poke at the data: a page with one shared filter row and two linked halves, grown here and shipped here.

**Page.** `/timpla/beans/`, nav label "Beans". Desktop wireframe:

```
+------------------------------------------------------------------------------+
| TIMPLA  Overview  Map  Cafés  Beans  About the data           theme  ivanka ↗|
+------------------------------------------------------------------------------+
| WHERE THE BEANS COME FROM                                   label-mono        |
| Benguet is on every menu. Sultan Kudarat grows the coffee.   serif h1         |
| And most of the cup was never grown here.                    muted lede       |
|                                                                               |
| [35,646 t grown]  [175,194 t shipped in]  [USD 813.6 M]  [44% from one prov.] |
|  stat tiles, 2025, each with a 2016-2025 sparkline and a one-line delta       |
+------------------------------------------------------------------------------+
| Year  2010 ────────●─── 2025   | Map metric  (tonnes) (t/ha) (share)          |
| Imports unit  (USD) (kg)        | Variety  (all) (Robusta) (Arabica) (Excelsa)|
+--------------------------------------+---------------------------------------+
| GROWN HERE                           | SHIPPED HERE                          |
| [choropleth, 92 provinces,           | [Sankey: Vietnam, Indonesia, Brazil,  |
|  hover = tooltip, click = pin]       |  Malaysia*, Thailand, Korea, China,   |
|  legend: binned ramp + "no data"     |  Other  ->  green / roasted /         |
|                                      |  extracts / preparations]             |
| [4 small multiples by variety]       |  *hub, "shipped via"                  |
|                                      | [unit value USD/kg, 4 panels]         |
+--------------------------------------+---------------------------------------+
| HOW IT MOVED  bump chart of regional share rank 2010-2025, Sultan Kudarat     |
| in --primary-strong, the rest muted; Benguet labelled at both ends            |
+------------------------------------------------------------------------------+
| Show the numbers (table view, both halves)  ·  PSA tables, retrieved <date>   |
+------------------------------------------------------------------------------+
```

Mobile: the two halves stack, the filter row becomes two chip rows that stay sticky under the header, the choropleth gets a province search field (the four-hundred-pixel map is too small to tap Siquijor), small multiples become a 2 x 2 grid.

**Interactions.** The year slider drives both halves (imports exist from 2016, so years 2010-2015 grey out the right half with "import tables start in 2016" rather than hiding it). Hovering a province highlights it in all four small multiples and shows tonnes, t/ha, variety split and rank; clicking pins it and writes `#p=<psgc>`. Hovering a Sankey link shows origin, form, kg, USD, USD/kg and share of the form. Hovering an origin node dims everything else (emphasis). State lives in the URL hash (`#y=2025&m=tpha&u=usd&p=1263`) so any view is a shareable link, and the page renders the 2025 default without JavaScript.

**Components** (`src/components/timpla/beans/`): `BeansStats.astro` (tiles, build-time), `BeansFilters.tsx` (one row, client:load, writes the hash), `ProvinceMap.tsx` (SVG from `provinces.json` paths projected at build time; d3-scale only on the client), `VarietyMultiples.tsx`, `OriginSankey.tsx` (layouts for every year and unit precomputed in the build script with d3-sankey, so the client only swaps coordinates with a CSS transition; no layout engine ships to the browser), `UnitValuePanels.astro` (build-time SVG), `RegionBump.astro` (build-time SVG), `BeansTable.astro`.

**Pipeline specifics.** `beans.json` holds per year: provinces[] {psgc, name, tonnes by variety, area, trees, tpha, share}, regions[] {share rank}, imports[] {origin iso, form, kg, usd}, sankeyLayouts {year}{unit}. Size estimate 300-500 KB gzipped under 120 KB (ASSUMED); if larger, split per year into `beans/<year>.json` and fetch on slide.

**Effort.** L (three to four weekends after the shared foundation). **Risks.** Most moving parts; the shared slider makes two different time ranges feel like one, which rule 12 handles with the greyed half.

---

## 3. Design B: "One cup, traced" (the story)

**For whom.** Readers on a phone, and the portfolio visitor who has thirty seconds. A scrollytelling page with a sticky graphic that changes as the text scrolls, in the receipt voice Timpla already uses.

**Page.** `/timpla/beans/`. One column of short text steps on the left (top on mobile), a sticky figure on the right (full-width sticky top on mobile). Steps:

```
STEP 0  Receipt (sticky figure = a thermal receipt, the existing Receipt styles)
        TIMPLA · THE CUP · 2025
        GROWN HERE ............ 35,646 t
        SHIPPED IN ............ 175,194 t
        PAID ................. USD 813.6 M
        FROM ONE PROVINCE ........... 44%
        TOTAL ................ 1 GOOD CUP
STEP 1  "Benguet is on every menu"      figure -> province choropleth, Benguet pinned,
                                         the HarvestChart dumbbell quoted as a caption
STEP 2  "Sultan Kudarat grows it"        same map, auto-plays 2010 -> 2025, Sultan Kudarat
                                         emphasised, counter ticks 24% -> 44%
STEP 3  "Robusta country"                map splits into the four variety small multiples
STEP 4  "Most of the cup was shipped"    figure pans east: Asia map (Natural Earth) with
                                         proportional circles at Vietnam and Indonesia, radius
                                         by kg, a second ring by USD, direct-labelled
STEP 5  "Beans from Vietnam, sachets     the circles unroll into the Sankey origin -> form
         from Indonesia"                 (value and weight shown as two stacked mini-Sankeys,
                                         never one with two scales)
STEP 6  "Shipped via, not grown in"      Malaysia / Switzerland / Singapore links hatched,
                                         caption explains hubs
STEP 7  Receipt again, with the year     a small year chip row lets the reader re-run the
        chip row                         story for 2016-2025
```

The receipt is a real component (`Receipt.astro` restyled as `CupReceipt.astro`), so the figure the reader starts and ends on is the same object with different line items.

**Interactions.** Scroll drives the figure (IntersectionObserver, one small vanilla script, no scrollytelling library). Each step is also a static, self-contained figure: with `prefers-reduced-motion` or no JavaScript the page renders all seven figures inline in order, which is also the print layout. Hover tooltips on the map and Sankey as in A. A "skip to the explorer table" link after step 7 opens the full table view.

**Components.** `CupReceipt.astro`, `ScrollStory.tsx` (client:visible, owns the sticky figure state), `ProvinceMap.tsx` and `OriginSankey.tsx` shared with A, `AsiaBubbles.astro` (build-time SVG; Natural Earth 110m projected once), plus the step texts in `src/data/timpla/beans-story.ts` so copy edits never touch components.

**Pipeline specifics.** Same `beans.json` as A plus `asia.json` (projected country paths and centroid coordinates for the top 12 origins). The auto-play in step 2 needs all sixteen years of province values, which the contract already fetches.

**Effort.** M (two to three weekends after the foundation). **Risks.** Scroll choreography is where time disappears; the reduced-motion fallback is the safety net, build it first and treat the animated version as progressive enhancement. Proportional circles need the 2 px surface ring and a minimum radius so Brazil and Laos remain hoverable.

---

## 4. Design C: "The supply receipt" (the compact figure)

**For whom.** The Timpla home page (it replaces the "Where the beans come from" section's single dumbbell with a richer figure) and a short `/timpla/beans/` page with the same figure at full width plus the table. Smallest build, and the shareable social card.

**Figure.** Two horizontal 100% stacked bars per year, 2016-2025, in rows, so weights are only ever compared within a form:

```
                 BEANS (green coffee, tonnes)                 EVERYTHING ELSE CALLED COFFEE (product weight, tonnes)
2025   |██████████ PH 35,646 |███████ VN 29,172 |██ ID |▏BR|     |████████████████████ ID 3-in-1 106,792 |███ VN extracts |▏MY roasted|
2024   |████████ PH 31,979   |██████████ VN 40,570 |███ ID |    |████████████████████ ...
 ...
2016   |...
       domestic = --primary-strong (emphasis); imported segments take the ordinal form ramp;
       origins separated by 2 px gaps and direct-labelled when the segment is wider than the label, else in tooltip
```

Left bar: domestic (PSA GCB, emphasised) against imported green by origin (PSA 0901.11/.12), commensurable in tonnes, so the "47% of green beans are grown here" reading is honest. Right bar: roasted, extracts, preparations by origin, product weight, with the caption "a kilo of 3-in-1 is mostly sugar and creamer; compare across the row, not across the two bars". A unit chip (tonnes / USD) switches the right bar to CIF value, where the left bar greys out (no reliable value for domestic beans without farmgate x volume x FX; that is project 5 of the report).

Under the bars: a small static province map in the DotMap style (`ProvinceDots.astro`, proportional circles for the top 10 provinces, Sultan Kudarat labelled), and the existing HarvestChart dumbbell moves beside it so the "menus vs harvest" point stays on the page.

**Page wireframe (home-page section).**

```
| WHERE THE BEANS COME FROM                                                   |
| Benguet is on every menu. Sultan Kudarat grows the coffee.                  |
| [ supply receipt: 10 rows x 2 bars, unit chips (tonnes)(USD) above ]        |
| [ province dots, top 10 ]        [ HarvestChart dumbbell (existing) ]       |
| Show the numbers · PSA, retrieved <date> · Open the full page →             |
```

**Interactions.** Hover a segment: origin, form, tonnes or USD, share of the bar. Keyboard: segments are focusable buttons. The unit chip is the only control. No slider: the years are the rows.

**Components.** `SupplyBars.astro` (build-time SVG; the unit toggle swaps a `data-unit` attribute and the two precomputed widths live as data attributes, a twelve-line script), `ProvinceDots.astro`, existing `HarvestChart.astro`, `BeansTable.astro`.

**Pipeline specifics.** Needs only the national GCB series, the 2016-2025 import tidy table and the top-10 province rows; the full contract still fetches everything so A or B can be added later without a new fetch.

**Effort.** S-M (one to two weekends after the foundation). **Risks.** Ten rows x two bars x up to eight origins is dense on a phone: on narrow screens render one bar per row (beans, then everything else) and collapse origins past the top 3 into Other with the table carrying the rest.

---

## 5. Which one, and in what order

Build the foundation first (one weekend: fetcher, crosswalk, HS groups, checks, `beans.json`, schemas). Then **C**, because it ships a complete, honest figure onto the home page in a weekend and proves the colour, table-view and footer conventions. Then **B** if the goal is the portfolio impression (it reuses C's data and A's map and Sankey components, and reads well on a phone), or **A** if the goal is a tool people return to. A and B share `ProvinceMap.tsx` and `OriginSankey.tsx`, so whichever comes second costs about a weekend less than listed.

Recommended: foundation -> C -> B, with A's filter row as a later enhancement to B's step 7.

## 6. Definition of done (any design)

- `python scripts/fetch_psa_coffee.py` runs clean from an empty `extra/psa/`, writes the manifest with every check passing, and runs clean again a day later with no diff except `fetchedAt`.
- Deleting one province from the crosswalk, renaming a crop label in a snapshot, or removing a year each make `npm run build` fail with a message that names the problem.
- Every figure has a table view, a legend when it has two or more series, a footer with PSA table titles and both dates, and works with JavaScript disabled (static 2025 view).
- Validator re-run after any colour change: `node <dataviz skill>/scripts/validate_palette.js "<hexes>" --mode light --surface "#f7f1e9"` and `--mode dark --surface "#1a1310"`; the contrast table in `pages/tala.astro` extended with the new pairs.
- Screenshots at 360, 768 and 1280 px, light and dark, checked for label collisions on the choropleth legend, the Sankey node labels and the stacked-bar direct labels.
- Comtrade cross-check logged in the manifest for 2022-2025 with every HS6 total within 0.1%.
- Attribution footer present on the beans page and the home-page section; `about the data` page gains the PSA import table row.
