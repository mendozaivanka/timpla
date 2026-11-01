> **Note added when saving (2026-10-21):** this plan was written while the dataset stood at 99 shops / 164 branches. After the indie discovery pass it is **109 shops / 174 branches (160 mapped; tiers 46 acclaimed / 60 recognised / 3 indie)**, and `manual_check.md` now also lists 56 location-unknown cafés. Counts below are otherwise as the planner checked them; the structure and decisions are unaffected.

# PLAN.md: a data-visualization site for Metro Manila's specialty-café scene

Status: plan only, nothing built. Written against the files in `/Users/ivankamendoza/Documents/portfolio/cafe-data/` as of 2026-10-21 (99 shops / 164 branches included; 151 mapped), the portfolio in `/Users/ivankamendoza/Documents/portfolio/tala-portfolio/` and the map app in `/Users/ivankamendoza/Documents/portfolio/cat-map/`.

## 1. Concept

**One-sentence story.** Metro Manila's specialty coffee is a small, dense, Makati-centred scene (99 shops, 164 branches) that reopened and expanded hard after 2022, runs on a handful of roasters and one green-bean hub (Kalsada feeds 21 of the 90 known café–roaster links), and puts Benguet on the menu (38 listings) while Sultan Kudarat grows fifteen times more beans (15,689 t vs 1,012 t, PSA 2025).

**Name options** (pick one; it becomes the repo and Render service name):

1. **Timpla** (Filipino: "blend, the way you take your coffee"). Short, brandable, pairs with the Tala star: "Timpla: Metro Manila's specialty coffee, mapped." Recommended.
2. **Kapehan Atlas** ("kapehan" = coffeehouse). Says exactly what it is; slightly long for a wordmark.
3. **Receipt: Manila** ("every café, one receipt"). Ties to the cat-map receipt motif and the per-café receipt cards; works if you want the two sites to feel like a family.

**Audience.** Primary: people in Metro Manila who care where their coffee comes from (home brewers, baristas, roasters, the KapeCon / Coffee Plz crowd), visiting coffee tourists, and food writers who need a sourced list. Secondary: people reading your portfolio, so the methodology page and the pipeline must be visible and credible.

**Editorial stance (shown on every page that needs it).** Tiers measure press coverage, not quality; "indie" means "no write-up yet", not "worse". "Status unclear" means we could not find 2025–26 evidence, not closed. A "low"-confidence opening year is an upper bound ("operating by 2016"). No Google/Foursquare ratings anywhere, by design.

## 2. Information architecture

| Route | What | Rendering |
|---|---|---|
| `/` | Hero number (shops / branches / roasters linked), the one-sentence story, four entry cards (Map, Directory, Beans, Timeline), a static SVG mini-map teaser, latest build date | static, 0 KB JS beyond theme menu |
| `/map/` | Explore map (MapLibre) with tier / roaster / city / type filters, pin → receipt card, deep links via hash | static shell + lazy React island |
| `/cafes/` | Directory: every included branch grouped by shop, receipt cards, search + filters (city, tier, own-roast, foreign brand) | static list, filter island enhances |
| `/cafes/[slug]/` | One page per **shop** (99 now, design for 250), listing its branches | static, `getStaticPaths` |
| `/roasters/` | Roaster → café network, most-connected roasters, Kalsada hub | static SVG + 3 KB hover script |
| `/beans/` | Where the beans come from: province → roaster flow, PH vs imports price strip, process mix, awards trail (farm → PCQC → café) | static SVG |
| `/timeline/` | Openings/closures 2012–2026 with confidence, café-sector CPI strip | static SVG |
| `/places/` | Cities and neighbourhoods: branch counts, per-capita and per-OSM-café ratios, NCR choropleth, mall floor placement | static SVG |
| `/stories/[chapter]/` | Scrollytelling chapters (v1: two; see section 7) | static + IntersectionObserver |
| `/data/` | Methodology, inclusion rules, tier definitions, counts parsed from `qa_report.md`, licences and attribution per source, how corrections flow, downloads | static |
| `/about/` | Why, who, colophon (Tala Rosa, OpenFreeMap, Render) | static |
| `/og/[slug].png` | OG image per shop + one per section page | build-time endpoint |

**Navigation.** Header identical in structure to the portfolio's `Header.astro`: star mark + wordmark, five links (Map, Cafés, Beans, Timeline, Places), CommandMenu (search cafés and roasters by name; cmdk is already in the stack) and ThemeMenu. Footer: Data, About, Stories, and the mandatory attribution line (section 5).

**Static-generated per shop** (`/cafes/[slug]/`):
- Receipt masthead: name, tier badge with one-line definition in a tooltip, type, ownership, "since YEAR" with a "by" prefix when the timeline confidence is low, neighbourhood and city.
- Branch list (each with address, city, and whether it has coordinates); 13 branches have none today and must still render.
- Static SVG mini-map (NCR outline + dots), no MapLibre on detail pages; "Open on the map" links to `/map/#cafe=slug`.
- Evidence block: `specialty_evidence`, `status_evidence` with date, `endorsement_sources` parsed into links labelled by outlet (prefixes in the data: spot 151, tatler 92, ohm 70, tripzilla 55, thebeat 49, hypebae 30, gma 27, wcm 25, philstar 14, baristamag 14, …), `community_signals` as badges.
- Relations: roaster edges touching the shop (relation type + evidence link + date), bean listings if the shop is also a roaster in `origins.psv`, timeline events, award mentions.
- JSON-LD `CafeOrCoffeeShop` (name, address, geo, sameAs website/instagram), canonical, OG image.
- Per-page attribution footer ("Coordinates © OpenStreetMap contributors (ODbL) via OSM/Nominatim; editorial facts cited above").

## 3. Visualizations

**Library decision (applies to every chart).** Charts are rendered to static SVG at build time by React components in `src/charts/` that are used *without* a `client:` directive (Astro renders them to HTML; zero client JS). They use `d3-scale`, `d3-shape`, `d3-array`, `d3-sankey` and `d3-force` as devDependencies, so the client never downloads D3. Interactivity is layered on by one tiny island, `ChartTooltip.tsx` (≈3 KB gz: delegates `pointermove`/`focus` on `[data-tip]` elements and positions a shadcn Tooltip-styled box) and a `data-tip` attribute written at build time. Every chart sits in `ChartFrame.tsx`: title (the claim), subtitle (the unit and n), legend, source line, and a "Show table" `<details>` holding a real `<table>` (the text alternative). Why not the alternatives: Observable Plot is excellent but its client bundle is ≈85 KB gz and server rendering needs jsdom; visx is fine but React-bound and adds nothing we need at build time; MapLibre only where there is a real map. Mark rules from the dataviz method apply: 2 px lines, ≥8 px dots with 2 px surface ring, 2 px gaps between adjacent fills, selective direct labels, text in text tokens (never series colour), one axis per chart (never dual-axis), legend for ≥2 series.

**Palette (validated, see section 4).** Tier is *ordinal* (amount of press): light `#df84a2` indie → `#b04a6f` recognised → `#7a2a49` acclaimed; dark `#7a3d56` → `#b55f80` → `#f2a3bc`. Plus shape: acclaimed = eight-point star, recognised = filled circle, indie = ring. Binary categories (local vs foreign brand, PH vs imported, café vs roaster): rose `#b04a6f` + ube-ink `#4a5fc8` (light), `#d4608a` + `#8f7de6` (dark). Magnitude: the rosas ramp (one hue). Emphasis: rose on `muted-foreground` grey.

### 3.1 Explore map (the centrepiece)
- **Question.** Where is specialty coffee in Metro Manila, which places have press behind them, and who roasts for whom?
- **Data.** `cafes.geojson` → slimmed at build to `cafes.points.json` with only: `id, shop, branch, tier, type, own (local/foreign), city, nb, lon, lat, roasters[]` (≈25 KB for 164 rows vs 200 KB today because the geojson carries all 27 columns). `roasters[]` comes from `data/roaster_edges.psv` joined by canonical name. The 13 branches without coordinates are listed in a "not on the map" note, like cat-map does.
- **Chart.** MapLibre GL 6 + OpenFreeMap `positron` (light) / `dark`, tinted on `style.load` exactly as `cat-map/src/components/CatMap.tsx` does, with `setWorkerUrl(workerUrl)` from the `?url` import (already solved there; copy that file as the starting point). Use a GeoJSON **source + layers**, not DOM markers: a `symbol` layer with two SDF sprites added via `map.addImage` (an eight-point star for acclaimed, a circle; indie uses a ring sprite), `icon-color` by `match(['get','tier'])`, `icon-size` stepped by zoom, clustering on below zoom 12 with a count label. Filters apply with `map.setFilter`, so no re-render.
- **Interactions.** Filter row above the map (one row, as the method demands): tier `ToggleGroup` (multi), roaster `Command` picker (searchable; 34 roasters), city chips, "roasts its own" `Switch`, "foreign brands" `Switch`. Click/Enter on a pin → bottom `Sheet` on mobile / side `Card` on desktop showing the receipt card with "Open page". State in the URL hash (`#tier=acclaimed,recognised&roaster=kalsada&cafe=slug`) so stories can deep-link. `prefers-reduced-motion` → `flyTo` duration 0. Theme switches re-load the style and re-apply tint (subscribe with the portfolio's `onThemeChange`).
- **Mobile.** Map at `min(68dvh, 640px)`, `cooperativeGestures: true` so the page still scrolls, filters in a horizontally scrolling chip row (pattern from `CatsApp.tsx`), results list below the map (the same filtered set) so nothing is pin-only.
- **Accessibility.** The directory list below is the full text alternative and is filtered by the same state; pins are not focusable (MapLibre layers aren't), so keyboard users use the list and "Show on map" buttons. Legend uses shape + colour + text. Indie's light pink is 2.47:1 on the page background, so the ring sprite gets a 1.5 px `foreground`-coloured outline to pass 3:1 for marks.

### 3.2 Roaster → café network
- **Question.** Who roasts for whom, and how central is Kalsada?
- **Data.** `data/roaster_edges.psv` (90 rows; relation: own_roast 32, serves 25, wholesale_stockist 22, host_venue 10, roasted_by 1). Nodes: 34 roasters + the cafés. Only 41 of 90 `cafe` strings match included shops by naive normalisation; the rest need the parenthetical stripped and the `ALIASES` map (e.g. "Yardstick Coffee Legazpi Village / MOA Square / SM Aura (own cafes)", "ANGKAN Coffee (Capitol Commons flagship + branches)"), and a few are outside NCR by design (Clean Beach Co in La Union, Gravacios in Davao, Good Cup's Cebu café): keep them as muted "outside NCR" nodes rather than dropping evidence.
- **Chart.** Force layout computed at build with `d3-force` (positions saved into `network.json`), rendered as static SVG. Node shape: roasters = eight-point star (own-roast cafés are both), cafés = circle, Kalsada = a distinct hexagon labelled "green-bean processor (not a roaster)". Edge style encodes relation with a single hue (solid = serves/roasted_by, dashed = wholesale_stockist, dotted = host_venue; own_roast collapses the two nodes into one starred node) so no 4-hue categorical palette is needed. Node size = degree (Kalsada 21, Yardstick 9, EDSA BDG 5, Type A 5, Plain Sight 5).
- **Interactions.** Hover/focus a node → highlight its ego network, dim the rest (CSS classes toggled by the 3 KB script); click → that shop page. A "most connected" bar list beside it (one series, rose).
- **Mobile.** Below 640 px the SVG is replaced by `Tabs`: one tab per hub roaster showing an adjacency list (Kalsada, Yardstick, EDSA BDG, Type A, Plain Sight, "others").
- **Accessibility.** The edge table (café, roaster, relation, evidence link, date) is the alternative; nodes are `<a>` elements with `aria-label`.

### 3.3 Province → roaster provenance flow
- **Question.** Which Philippine provinces do Manila roasters actually put on the shelf, and how does that compare with where coffee is grown?
- **Data.** `data/origins.psv` (318 listings; country Philippines 132 + "Philippines (mixed)" 10; province filled on 132 rows: Benguet 38, Bukidnon 23, Davao del Sur 22, Mountain Province 9, Batangas 8, Sultan Kudarat 7, Cavite 5, South Cotabato 3, Ilocos Sur 3, Negros Occidental 3, Kalinga 2), roaster per row (Plain Sight 56, H Proper 55, Escolta 26, Primal Brew 25, Commune 22, Angkan 18, Good Cup 17, Bo's 14, …). Production: `extra/psa_coffee_green_beans_by_province_2022_2025.csv` (Latin-1 encoded; crop "Coffee (green coffee beans)", provinces are the rows with four leading dots; 2025: Sultan Kudarat 15,689 t, Bukidnon 2,246, Sulu 2,217, Davao del Sur 1,574, Cavite 1,230, Maguindanao del Norte 1,153, Benguet 1,012).
- **Chart.** Two-stage Sankey (`d3-sankey` at build): province (top 8 + "other PH") → roaster (top 10 + "other"), link width = listings. Beside it, a **dumbbell** per province: "share of Manila listings" vs "share of national green-bean output" on one percentage axis (never a dual axis). This is the "Benguet on the menu, Sultan Kudarat in the fields" chart. Imports are a separate small bar list (Panama 35, Ethiopia 27, Colombia 12, Brazil 11, Kenya 6, Indonesia 6, Laos 5) to answer "what else is on the shelf".
- **Interactions.** Hover a link → tooltip "Benguet → Plain Sight: 12 listings"; click a roaster → its page. Mobile: Sankey switches to a stacked horizontal bar per province (roaster segments, 2 px gaps), which is the same data in a form that fits 360 px.
- **Accessibility.** Table of province × roaster counts and the PSA table with units.

### 3.4 Openings and closures timeline
- **Question.** When did this scene grow, and how sure are we of each date?
- **Data.** `data/timeline.psv` (143 events: opened 131, closed 6, rebranded 2, moved 2, reopened 2; confidence high 27 / medium 65 / low 51; month present on 78; by year: 2012 3, 2013 7, 2014 5, 2015 3, 2016 11, 2017 4, 2018 5, 2019 8, 2020 9, 2021 11, 2022 18, 2023 18, 2024 16, 2025 9, 2026 16). Only 54 rows match included shops; the rest belong to excluded, unclear or closed shops (Hey Handsome 2018, Ella and the Blackbird 2021, %Arabica BGC 2022, Poison 2024, Del Union 2025) and are shown as "ecosystem" events, which is the honest frame.
- **Chart.** Diverging columns by year: openings up, closures down, baseline 0, 4 px rounded data-ends, included shops in rose and ecosystem events in grey (emphasis form). Confidence as **texture**: high solid, medium 60 % opacity, low hatched (the method's 45° texture) with the legend reading "low = operating by this year (upper bound)". 2026 is marked partial. Under it, a dot strip of individual events with hover (name, branch, event, evidence type, link).
- **Interactions.** Hover a column → counts by confidence; click a year → filters the dot strip. Mobile: columns stay (15 years fit), dot strip becomes a list.
- **Accessibility.** Event table with evidence URLs; the hatching gives a non-colour channel for confidence.

### 3.5 Bean price distribution
- **Question.** What does 250 g of specialty coffee cost in Manila, and are Philippine single origins pricier than imports?
- **Data.** Use `data/origins.psv` (307 priced rows, with grams, province, process, product URL, fetched_at), normalised to ₱/250 g at build and **restricted to bags ≥ 200 g** (grams distribution: 200 g 115, 250 g 56, 100 g 48, 20 g drip bags 42, blank 33, 300 g 10). Note the two existing files disagree because of basis: `bean_prices_per250g.csv` gives PH median ₱1,000 (n = 28) vs imports; origins.psv normalised across all sizes gives PH ₱725 (n = 105) vs imports ₱894 (n = 180). The site must compute from one file, state n and the size filter, and only print the "₱1,000 vs ₱925" headline if it reproduces under the stated filter.
- **Chart.** Strip plot (jittered dots, ≥8 px, 2 px surface ring) per class: Philippine single origin / imported / blend-unknown, median tick with label, rose vs ube-ink for PH vs import, blends grey. Range is ₱490–₱3,625, so a linear axis with the top five outliers labelled directly (Panama geshas) reads better than log; cap the axis at ₱2,500 with a "+5 above" note if the geshas crush the body.
- **Interactions.** Hover a dot → product, roaster, origin, process, price per 250 g, link; filters: process (washed 76, natural 67, honey 25, carbonic maceration 11, anaerobic 17). Mobile: strips stack vertically.
- **Accessibility.** Table sorted by price with the URL and fetch date (prices drift; every row carries both).

### 3.6 City and neighbourhood density
- **Question.** Where is specialty coffee thick and where is it absent, once you account for population and for cafés in general?
- **Data.** Branch counts by stated city (Makati 54, QC 32, Taguig 24, Mandaluyong 13, Pasig 8, Manila 8, San Juan 7, Muntinlupa 6, Marikina 6, Parañaque 4, Pasay 2; zero in Caloocan, Malabon, Navotas, Valenzuela, Las Piñas, Pateros) and by neighbourhood (BGC 24, Poblacion 14, Legazpi Village 13, Ortigas Center 6, Rockwell 6, Salcedo 6, Alabang 6). Denominators: (a) 2020 census city populations (add a 17-row `extra/psa_census_2020_ncr_cities.csv`; PSA open data); (b) all OSM cafés per city from `sources/osm_ncr_cafes.json` (2,314 elements, 2,158 nodes with coordinates; point-in-polygon against `ncr_adm3.geojson` at build) giving "specialty share of all cafés", which needs no new pull; (c) per-office is **not possible yet**: `extra/overpass_ncr_context_counts.csv` only has NCR-wide totals (offices 3,816, condos 3,578, campuses 424, stations 106), so a per-city Overpass query is a v2 task (free, one script).
- **Chart.** One horizontal bar chart with a `ToggleGroup` for the measure (branches / per 100k residents / share of OSM cafés), single rose series, direct value labels, the six zero cities shown as explicit "0" rows (the absence is the story). Beside it a **choropleth** of the 16 cities on the simplified NCR polygons (sequential rosas ramp, 5 classes) with the caveat drawn in: geoBoundaries puts BGC inside Makati, so the choropleth counts by polygon containment while the bars count by stated city; both are labelled as such.
- **Interactions.** Hover city → all three measures; click → directory filtered by city. Mobile: bars only; choropleth collapses into the bars' tooltip.
- **Accessibility.** The bars are the table; a `<table>` repeats all measures.

### 3.7 Mall floor placement
- **Question.** In the malls we can see, which floor do cafés sit on, and are the specialty names among them?
- **Data.** `extra/ortigas_malls_tenants.csv` (996 rows, 32 café-like; floors like "East Wing, 3F", "Main Mall, LGF"), `extra/robinsons_mm_tenants.csv` (1,659 rows, 41 café-like; "Level 2 (Al Fresco)", with some concatenation noise), `extra/araneta_city_dining_tenants.csv` (150, 15 café-like; "UGB, Gateway Mall 2"), `extra/bgc_coffee_pastries_tenants.csv` (8; floor embedded in the name: "One Bonifacio High Street - LG"), `extra/podium_tenants.csv` (12 cafés, no floor; counts only). Floor parsing rule at build: map to ordered levels B/LG, GF, UG/M, 2, 3, 4+; "Al Fresco" → GF. Café-like flags are name regex (they catch "Kenny Rogers Roasters" and miss names like "Single Origin"), so ship a hand-verified allowlist `data/mall_matches.psv` (mall | tenant | shop_slug | is_cafe) and show only verified rows; join to our shops by name: Angkan (Estancia, Podium), H Proper (Robinsons Magnolia L2), Candid (Magnolia L4, Manila L3), harlan (Robinsons Manila L2), Craft Coffee Revolution and Caerus (Podium).
- **Chart.** A "mall section" unit chart: each mall is a stacked column of floors (ordered bottom to top), each café a dot on its floor; dots in rose when the tenant is in our dataset, grey otherwise; chains (Starbucks, CBTL, ZUS, Pickup…) hollow. One summary bar: share of cafés per floor level across all malls.
- **Interactions.** Hover a dot → tenant, floor, directory link. Mobile: one mall per `Tabs` panel.
- **Accessibility and honesty.** Table per mall; a visible note that SM, Ayala and Megaworld directories forbid crawling, so this is "the malls that publish a directory", not Metro Manila's malls.

### 3.8 Café-sector inflation
- **Question.** Has eating out (and café coffee) inflated faster than coffee at home and than everything else in NCR?
- **Data.** `extra/psa_cpi_ncr_coffee_restaurants_2018_2026.csv` (Latin-1; 8 series = PH and NCR × {all items, 01.2.2 coffee and substitutes, 11 restaurants and accommodation, 11.1.1 restaurants, café and the like}; 108 month columns Jan 2018–Dec 2026 with ".." for months not yet published; base 2018 = 100). NCR 2025 averages: restaurants/café 129.8, coffee at home 116.9, all items 125.4.
- **Chart.** Indexed line chart, one axis (already 2018 = 100): NCR restaurants/café in rose, NCR coffee at home in ube-ink, NCR all items in grey; PH series as a faint second panel (small multiple), not a fourth line. Crosshair tooltip listing all three at that month. Below it, sharing the x axis, a thin strip of openings per year from 3.4 (separate panel, separate y; no dual axis).
- **Mobile.** Full width, 2 px lines, legend as direct labels at the line ends.
- **Accessibility.** Monthly table; "last published month" stated; a note that Yardstick menus rose ≈20 % 2022→2026 (from `sources/ys_*.pdf`) is a v2 hand-extracted data point, not a series.

### 3.9 Awards trail: farm → competition → café
- **Question.** Can you drink a competition-winning Philippine lot in Manila, and whose baristas won what?
- **Data.** `data/awards_events.psv` (123 rows: pcqc 50, barista 34, event 39; years 2015–2026; PCQC rows carry farmer/coop, rank with score, province_or_city: Davao del Sur/Bansalan 16, Sultan Kudarat 5, Bukidnon 9, Ilocos Sur 7, Cotabato 2). The farm → café link is only implicit today (H Proper, Intuit, Angkan, Good Cup retail PCQC lots per the key findings) so add a small hand table `data/award_lots.psv` (award_row_id | shop_slug | product | url) built by matching `origins.psv` `origin_place` (Balutakay, Sitio Belis/Atok, Pangantucan, Sigay…) to award rows. Barista champions: few affiliations match included shops (Yardstick, The Giving Cafe); most are Cebu, Baguio or Henry & Sons, which is itself worth saying.
- **Chart.** A three-column "trail" (static SVG, like a subway diagram): left column PCQC winners by year (dots on a vertical year axis, labelled by province), middle the competition/year, right the Manila shops that retail the lot, with connectors; below, a compact year × competition grid of national champions with their café in text. Colour is emphasis only (connected rows rose, others grey); no categorical palette.
- **Mobile.** Becomes a chronological list of cards ("2024 PCQC Arabica 1st · Balutakay, Davao del Sur → sold at H Proper (link)").
- **Accessibility.** The list is the table; each connector has a text equivalent.

### 3.10 Smaller pieces
- Hero stat tiles on `/`: shops, branches, roasters linked, bean listings, with "built 2026-10-21" from the data (a stat tile, not a one-bar chart).
- Tier breakdown on `/data/`: three stat tiles with the definitions (45 / 51 / 3 shops), not a pie.
- Rainfall normals (`extra/pagasa_rainfall_normals_ncr.csv`, 3 stations) and rail ridership are context only; v2 as a muted strip under the timeline if a story needs them.

## 4. Design direction: Tala Rosa for data

- **Tokens.** Copy `tala-portfolio/src/data/tokens.ts` and `scripts/gen-tokens.ts` unchanged, then add a `viz` block to the Theme type: `tier1/tier2/tier3` (ordinal), `cat1/cat2` (binary categorical), `seq1..seq5` (rosas), `dim` (grey for de-emphasis), `grid` (hairline). Light: tier `#df84a2 / #b04a6f / #7a2a49`, cat `#b04a6f / #4a5fc8`; dark: tier `#7a3d56 / #b55f80 / #f2a3bc`, cat `#d4608a / #8f7de6`. These were run through the dataviz palette validator: the ordinal ramps pass (monotone L, ΔL ≥ 0.06, light end ≥ 2:1) in both modes; the two-slot pairs pass all-pairs checks in both modes. A three-hue rose/violet/green set was tried and **fails** CVD separation (rose vs green ΔE 4–6 under deutan) and the chroma floor, which is why tiers use one hue plus shape and all other categories are binary. Extend the build-time contrast check in the Tala page pattern so a token edit can't regress the chart palette.
- **Map tint.** Light: background `#fbf6f7`, water `#dfe8f1` (langit desaturated), park `#e8efe9` (pandan desaturated), building `#f3eaed`; dark: `#171014`, `#1e2731`, `#1f2622`, `#241b20`. Same `style.load` paint-property loop as cat-map. Road and label layers stay as positron draws them (they are the legibility layer).
- **Type.** Newsreader for page titles, chart titles (the claim) and story prose; Figtree for UI; DM Mono for receipts, axis ticks, tooltips and every number (`tabular-nums`). Chart labels 12 px mono in `muted-foreground`, never in the series colour.
- **Motifs.** The eight-point star is the acclaimed marker (map, network, legend) and the favicon. The inabel stripe is the section divider and the legend ribbon on story pages. The receipt card (port `cat-map/src/components/Receipt.tsx` and the `.receipt` / `.receipt-shadow` / `.receipt-rule` CSS with the paper tokens) is the café card everywhere: masthead = shop name, rows = WHERE / SINCE / ROASTER / TIER / WRITE-UPS, barcode seeded by slug, "TOTAL: 1 GOOD CUP". Paper stays light in both themes, as in cat-map.
- **Dark mode.** Reuse the portfolio's `data-theme` + `theme.ts` + head script; charts read CSS variables so they flip without re-render; the map island subscribes to `onThemeChange` and swaps the style. High-contrast themes come for free from tokens; verify the hatched texture reads in `forced-colors`.
- **Motion.** Reveal-on-scroll and scrolly transitions only under `prefers-reduced-motion: no-preference` (the portfolio's `.js-reveal` pattern); map `flyTo` duration 0 otherwise.

## 5. Data pipeline

**Source of truth stays in `cafe-data/`.** The Python pipeline (`scripts/build_dataset.py` → `cafes.csv`, `cafes.geojson`, `qa_report.md`) is unchanged in spirit; the site adds one Node script that derives site JSON from those outputs plus the PSV/CSV side tables.

**Two small changes to `build_dataset.py` (recommended, need your OK):** emit `shop_slug` and `branch_slug` columns (so JavaScript never re-implements `norm()`/`ALIASES`), and emit `year_confidence` by carrying the matched timeline row's `confidence` (today `first_opened_year` is shop-level, 112/164 filled, with no confidence in `cafes.csv`; `editorial_list.psv` has `year_source` on 86/216 rows, about 33 of them upper bounds).

**`scripts/build-data.ts`** (run as `node scripts/build-data.ts`, Node 24 type-stripping, like `gen-tokens.ts`), `DATA_DIR` defaults to `../cafe-data`. It writes committed files to `src/data/generated/` (commit them, as cat-map commits `cats.generated.json`; Render only builds what is in git):

| Output | From | Join / transform | Size (est.) |
|---|---|---|---|
| `shops.json` (build-only, not shipped) | `cafes.csv` included rows grouped by `shop_slug` | branches, evidence, sources parsed `prefix:url;…` | 160 KB |
| `cafes.points.json` | `cafes.geojson` | 10 fields, 4-decimal coords, roasters[] from edges | 25 KB |
| `network.json` | `roaster_edges.psv` | alias + parenthetical strip; `d3-force` layout baked | 15 KB |
| `provenance.json` | `origins.psv` + PSA production | province/roaster counts; sankey nodes/links baked | 6 KB |
| `prices.json` | `origins.psv` | ₱/250 g, grams ≥ 200, class PH/import/blend | 10 KB |
| `timeline.json` | `timeline.psv` | matched flag, confidence, month | 12 KB |
| `cpi.json` | PSA CPI (read as Latin-1) | NCR + PH series, drop ".." | 6 KB |
| `places.json` + `ncr.topo.json` | `cafes.csv`, census CSV, OSM dump counts, `ncr_adm3.geojson` | PIP counts; polygons simplified with mapshaper (`-simplify 8% keep-shapes`, dissolve the 13 Manila districts into Manila) → TopoJSON | 8 KB + ≈45 KB (from 1.45 MB) |
| `malls.json` | the five mall CSVs + `mall_matches.psv` | floor parser; verified rows only | 6 KB |
| `awards.json` | `awards_events.psv` + `award_lots.psv` | shop links | 12 KB |
| `meta.json` | `qa_report.md` | counts, build date | 1 KB |

Encoding gotchas found: the two PSA files are Latin-1; PSV rows are split on `|` after stripping `#` comments (mirror `read_psv`); `endorsement_sources` is `prefix:url;prefix:url`; `community_signals` is `kind:value;…`.

**Updates and corrections.** Flow: edit `data/indie_*.psv` (new discoveries; `indie_osm.psv` has 10 rows today, `manual_check.md` lists 13 candidates for `indie_manual.psv`), `data/status_updates.psv` (63 rows), `data/corrections.psv` (4 rows; precedence correction > status_updates > row) → `python3 scripts/build_dataset.py` → `npm run data` → commit → Render rebuilds. The `/data/` page documents exactly this and links a GitHub issue template ("Suggest a correction: café, branch, what changed, evidence URL") so readers can report; no backend.

**Licensing and attribution, per source, encoded in `src/data/sources.ts` and rendered on `/data/` and in footers:**
- OpenStreetMap (coordinates for 87 branches via OSM, 62 via Nominatim; all-café counts): "© OpenStreetMap contributors, ODbL". Because `cafes.csv` contains OSM-derived coordinates, offer the downloadable CSV/GeoJSON under ODbL; do not ship `sources/osm_ncr_cafes.json` or the Starbucks list; only aggregated counts per city leave the build.
- OpenFreeMap tiles: attribution control stays on the map ("© OpenFreeMap © OpenMapTiles Data © OpenStreetMap contributors").
- PSA OpenSTAT (CPI, production, census, rail): "Source: Philippine Statistics Authority (OpenSTAT), table ids listed", free reuse with attribution.
- Editorial facts: cited per café by outlet and URL (that is the `endorsement_sources` column); no article text reproduced.
- Roasters' own shops (Shopify `products.json`, 12 stores): show product name, price, origin, link; never the raw `shopify_products.csv` (1,951 rows).
- Mall directories: only verified café rows and counts; name the directory as source; note the ones that forbid crawling were not used.
- PAGASA, ICO, event sites: cite by URL and fetch date.
- Nothing from Google, Foursquare, Yelp, Wanderlog or Booky, stated explicitly.

## 6. Repo, components, performance, SEO

**New repo** `timpla/` (sibling of the other two), bootstrapped by copying from `tala-portfolio`: `astro.config.mjs` (+ `site`, `sitemap`), `render.yaml` (static site, `npm ci && npm run build`, `NODE_VERSION=24`, cache and security headers; add a redirect for slash-less routes), `components.json`, `tsconfig.json`, `src/styles/global.css`, `src/data/tokens.ts`, `scripts/gen-tokens.ts`, `src/layouts/Layout.astro`, `Header.astro`, `Footer.astro`, `StarMark.tsx`, `ThemeMenu.tsx`, `CommandMenu.tsx`, `lib/theme.ts`, `lib/contrast.ts`. From `cat-map`: `CatMap.tsx` (→ `CafeMap.tsx`), `Receipt.tsx` and the receipt/map CSS.

```
timpla/
  package.json            scripts: data, tokens, predev, prebuild, dev, build (astro check && astro build), preview
  scripts/build-data.ts   cafe-data → src/data/generated/*.json (section 5)
  scripts/gen-tokens.ts
  src/data/tokens.ts  sources.ts  site.ts  generated/
  src/lib/names.ts (slug/alias helpers mirrored from Python)  format.ts  theme.ts  scales.ts
  src/charts/  ChartFrame.tsx Axis.tsx Bars.tsx DivergingColumns.tsx IndexedLines.tsx StripPlot.tsx
               Sankey.tsx Dumbbell.tsx Network.tsx MallSection.tsx Choropleth.tsx MiniMap.tsx AwardsTrail.tsx
  src/components/  CafeMap.tsx (island) MapFilters.tsx Receipt.tsx TierBadge.tsx DirectoryFilters.tsx (island)
                   ChartTooltip.tsx (island) NetworkHover.ts (3 KB script) Scrolly.astro SourceList.astro
                   Header.astro Footer.astro StarMark.tsx ThemeMenu.tsx CommandMenu.tsx ui/ (shadcn)
  src/layouts/Layout.astro
  src/pages/ index.astro map.astro cafes/index.astro cafes/[slug].astro roasters.astro beans.astro
             timeline.astro places.astro stories/[chapter].astro data.astro about.astro 404.astro
             og/[slug].png.ts
  public/ favicon.svg robots.txt sprites/star.png
```

**shadcn components to reuse** (already in the portfolio): `button`, `badge`, `card`, `dialog`, `toggle-group`, `toggle`, `select`, `command`, `table`, `tabs`, `tooltip`, `separator`, `switch`, `kbd`, `dropdown-menu`, `input`. Add: `sheet` (mobile pin card and filters), `popover` (legend definitions), `scroll-area` (directory on mobile).

**Dependencies.** `maplibre-gl ^6.15` (client, lazy), `d3-scale d3-shape d3-array d3-sankey d3-force d3-geo topojson-client` (build only), `mapshaper` (dev, one-off simplification script), `satori @resvg/resvg-js` (dev, OG images), `csv-parse` (dev). No chart runtime on the client.

**Performance budget (gzipped).**
- Every non-map page: ≤ 60 KB JS total (React runtime ≈ 45 KB is the floor if any island is on the page; ThemeMenu + CommandMenu ≈ 20 KB in the portfolio build). Pages with no island at all (shop pages, stories) ship only the inline theme script.
- `/map/`: MapLibre ≈ 270 KB gz (cat-map's `CatMap` chunk is 1.07 MB raw) loaded via `client:visible` behind a static SVG placeholder; total ≤ 350 KB gz; tiles from OpenFreeMap on demand.
- Data per page ≤ 60 KB gz (`ncr.topo.json` ≈ 45 KB only on `/places/`).
- CSS ≤ 50 KB gz (portfolio is 110 KB raw); fonts self-hosted, subset to Latin, `font-display: swap`.
- Targets on a mid-range Android over 4G: LCP < 2.5 s, no CLS from charts (SVGs have fixed `viewBox` aspect ratios), INP < 200 ms (filters via `setFilter`, not re-render).

**SEO / OG.** `@astrojs/sitemap`; canonical + `trailingSlash: "always"` as in the portfolio; JSON-LD per shop; OG images at build via satori (receipt layout: star, name, tier, city, "since YEAR", stripe) from `/og/[slug].png.ts` using `getStaticPaths` over shops plus the seven section pages; `twitter:card summary_large_image`; `robots.txt` allow all; descriptive `<title>`s ("Yardstick Coffee · Legazpi Village, Makati · Timpla").

## 7. Roadmap

**MVP (smallest shippable; two weekends, ≈ 22–28 h)**
1. Repo bootstrap from the portfolio + tokens with the `viz` block and the validator-checked values (2 h).
2. `build-data.ts`: shops, points, timeline, places (bars only), meta; slug columns in Python (4 h).
3. Layout, header, footer, `/`, `/about/`, `/data/` with rules, tiers, counts, licences (3 h).
4. `/cafes/` directory with receipt cards and a client-side filter island; `/cafes/[slug]/` pages with evidence, branches, mini-map, JSON-LD (5 h).
5. `/map/` with tier/roaster/city filters, sheet/receipt on pin, hash state, lazy load, theme-aware tint (6 h).
6. `/timeline/` diverging columns with confidence texture and event table; city bars on `/places/` (3 h).
7. Render deploy, Lighthouse and axe pass on phone and desktop (2 h).
Acceptance: all 164 branches reachable (13 without coordinates listed, not lost); map filters work with keyboard-only via the list; every chart has a table toggle; no Google/Foursquare strings anywhere; attribution line on every page; Lighthouse a11y ≥ 95, performance ≥ 85 on `/map/` mobile; contrast check passes in all four themes at build; build time < 60 s.

**v1 (≈ 30–40 h)**
- Roaster network (layout baked, hover script, mobile tabs); provenance Sankey + dumbbell; price strip; CPI lines; mall section with `mall_matches.psv`; awards trail with `award_lots.psv`; choropleth from simplified TopoJSON; OG images; two stories ("Two villages and a strip: Legazpi, Salcedo, Poblacion" and "Kalsada: the hub you can't visit") using sticky map + hash deep links; CommandMenu search over cafés and roasters; GitHub issue template for corrections.
Acceptance: every chart in section 3 live with source line, legend, tooltip and table; palette validator output pasted into `/data/`; stories degrade to stacked static sections under reduced motion; map OG previews render in Slack/Twitter validators.

**v2**
- Per-city Overpass pull (offices, condos, campuses, stations) for normalised density; province choropleth of PSA output (geoBoundaries ADM2); Foursquare OS Places `date_created/closed` timeline for all NCR cafés (needs your HF login); Yardstick menu index from the four PDFs; rainfall/ridership context strips; `indie_manual.psv` pass from `manual_check.md` to grow the indie tier past 3 shops; "ecosystem" view of excluded-but-known shops with their reason; bilingual labels (Filipino/English) if wanted.

**Risks and mitigations**
- Name joins drift as the dataset grows (41/90 edges, 54/143 timeline rows match naively): slugs emitted by Python, aliases live in one place, build fails on unmatched edges to included shops unless listed in an allowlist.
- GeoJSON size and BGC-in-Makati: simplify + dissolve at build; count by polygon for the choropleth and by stated city for bars, both labelled.
- MapLibre on mobile: lazy `client:visible`, cooperative gestures, static fallback; the worker URL issue is already solved in `CatMap.tsx`.
- Data freshness ("unclear" is the largest exclusion, 58 rows): show the build date and the status evidence date per café; never render "closed" unless `status_closed`.
- Licences: ODbL share-alike handled by publishing downloads under ODbL; mall directory copyright handled by publishing only café rows and counts; Shopify data shown per product with link, never dumped.
- Low-confidence years read as facts: "by YEAR" wording and hatching everywhere a year appears.
- Free-tier limits: Render static (100 GB/month) and OpenFreeMap (no caps) are fine; no API keys exist to leak.

## 8. Open questions for Ivanka

1. Name and home: **Timpla** (or another) as its own repo and Render static site, or a sub-path of the portfolio? (Separate site recommended; link both ways.)
2. May the site's build add `shop_slug`, `branch_slug` and `year_confidence` columns to `cafes.csv` via `scripts/build_dataset.py`, and may I add `data/mall_matches.psv`, `data/award_lots.psv` and `extra/psa_census_2020_ncr_cities.csv` to `cafe-data/`?
3. Publish downloads (`cafes.csv` / GeoJSON) on `/data/` under ODbL, yes or no?
4. Which two stories first (my picks: the Makati villages, and Kalsada as the hidden hub)?
5. Is a per-city Overpass pull (one free query per city, ≈ 16 requests) acceptable for v2, and do you want the Foursquare OS Places step (requires your Hugging Face login)?

---

### Critical Files for Implementation
- /Users/ivankamendoza/Documents/portfolio/cafe-data/scripts/build_dataset.py (source of `cafes.csv`/`cafes.geojson`; add slug and year_confidence columns; its `ALIASES`/`norm()` must be mirrored in the site's `names.ts`)
- /Users/ivankamendoza/Documents/portfolio/cafe-data/cafes.csv (29 columns, 226 rows, 164 included; the directory, map and detail pages derive from it)
- /Users/ivankamendoza/Documents/portfolio/cat-map/src/components/CatMap.tsx (MapLibre 6 + `setWorkerUrl` + OpenFreeMap tint pattern to copy for `CafeMap.tsx`)
- /Users/ivankamendoza/Documents/portfolio/tala-portfolio/src/data/tokens.ts (Tala Rosa tokens to extend with the validated `viz` palette; feeds `gen-tokens.ts` and the build-time contrast check)
- /Users/ivankamendoza/Documents/portfolio/cafe-data/data/roaster_edges.psv (90 edges; the network, provenance and per-café relation sections all hinge on cleanly joining its `cafe` strings to shops)
