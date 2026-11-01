# Extra data sources for the Metro Manila specialty-café viz (verified 2026-10-21)

All checks were done live with curl / WebFetch from this machine. WebSearch was unavailable (shared budget exhausted), so every item below is either directly fetched (VERIFIED) or marked UNVERIFIED. Raw responses are in `raw/`; pulled data are the CSVs listed at the end.

## Ranked table

| # | Source | Fields | NCR coverage | Licence / terms | Cost | Verified example | Viz it enables |
|---|--------|--------|--------------|-----------------|------|------------------|----------------|
| 1 | **Ortigas Malls directory JSON** (Estancia/Capitol Commons, Greenhills, Tiendesitas, The Strip) – `ortigasmalls.com/<mall>` embeds an Inertia `data-page` JSON with `mall_directory.floors[].stores[]` | name, floor, wing/location, category (Shop/Dining/Bank), contact no., SVG floor-plan polygon coordinates, cover photo | 996 unique tenants in 4 malls (Estancia 306, Greenhills 919 raw incl. stalls, Tiendesitas 39, The Strip 36); 36 café-like names (Angkan, Blue Wonder, Café Perene, Pedal Café, CBTL…) | robots.txt `Disallow:` (empty = allow all); site has no explicit scraping ToS found; copyright on content | free | `curl https://www.ortigasmalls.com/estancia` → `data-page` JSON, `props.mall_directory.floors` (13 floors) → e.g. `{"name":"Blue Wonder Coffee","location":"3F, East Wing","type":4}` | Floor-by-floor café map of a mall; café share of mall tenancy; "which floor do cafés live on" |
| 2 | **The Podium WP REST API** – `thepodium.com.ph/wp-json/wp/v2/store` + `store_category` taxonomy | name, slug, categories (cafe/dining/…), blurb, gallery, modified date | 198 tenants, 12 tagged `cafe` (Angkan, Caerus, CBTL, Craft Coffee Revolution, Dot Coffee, Lola Cafe, Mary Grace, Starbucks Reserve…) | robots allows; `wp-admin/admin-ajax.php` explicitly allowed; no floor field | free | `GET /wp-json/wp/v2/store_category` → `(82,'cafe',12)`; `GET /wp-json/wp/v2/store?per_page=100&page=1..2` → 198 records | Mall café roster with chain vs independent split; modified-date = tenant churn proxy |
| 3 | **Robinsons Malls Virtual Mall Directory** (Google Sites, linked from robinsonsmalls.com) | tenant name, floor/wing, phone, e-menu link | 9 Metro Manila malls parsed → 1,659 tenant rows, 41 café-like (Galleria, Magnolia, Manila, Novaliches, Metro East, Las Piñas, Malabon, Otis, The Plaza) | robinsonsmalls.com robots.txt permissive (Drupal default); Google Sites public page; parsing is fragile (text split across spans) | free | `https://sites.google.com/view/rmallsvirtualmalldirectory/list-of-malls/metro-manila/robinsons-magnolia` → "HPROPER COFFEE ROASTERS 📍 Level 2 (Al Fresco)" | Café count per Robinsons mall; ZUS/Pickup Coffee penetration across malls |
| 4 | **Araneta City directory** – `aranetacity.com/dining?page=1..5` + `/establishment/{id}` (Google-Maps link exposes building) | name, building (Gateway Mall 2, Ali Mall, Cyberpark towers), floor code (GF/UGA/UGB…), category | 150 dining tenants; Gateway Mall 2 = 87, Ali Mall = 48; 15 café-like (UCC Park Café, Tomoro, ZUS, Pickup, Mango Tree Cafe, Mary Grace…) | no robots.txt (404); no ToS found; 1 req/s used | free | `/establishment/10` → maps link `query=Gateway+Mall+2,+Araneta+City` + "UGB, Gateway Mall 2" | Cubao node: cafés per building, chain density around MRT/LRT Cubao |
| 5 | **BGC (bgc.com.ph) directory, category "Coffee & Pastries"** | name, building + floor ("One Bonifacio High Street - LG"), tags (outdoor seating, pet-friendly), hours, phone, Michelin tag | 15 café-type entries over 2 pages (Burnt Bean, Coffee Lab, Elephant Grounds, Single Origin, %-style…), but covers only Ayala-managed BHS/One BHS, not all of BGC | robots: `Crawl-delay: 10` (respected); site is WordPress/WooCommerce | free | `https://bgc.com.ph/go/dine/coffee-pastries-dine/` → "Burnt Bean – Bonifacio High Street Central C2 Bldg - UG" | BHS micro-map with floor level; "outdoor seating" attribute overlay |
| 6 | **PSA OpenSTAT PXWeb API – CPI 2018=100 by commodity × region** table `0012M4ACP22.px` | monthly index Jan 2018–Sep 2026 for 354 COICOP items × 120 geolocations (NCR, each region, provinces) incl. `01.2.2 Coffee and coffee substitutes`, `11.1.1 Restaurants, café and the like` | NCR row available | PSA open data (free reuse with attribution) | free | POST JSON query to `https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2M/PI/CPI/2018NEW/0012M4ACP22.px` → NCR coffee CPI 2025 avg **116.9** vs all-items **125.4**; NCR "Restaurants, café" **129.8** | Line chart: café-sector inflation vs coffee-at-home vs all items, NCR vs PH |
| 7 | **PSA OpenSTAT – coffee production by province** `0072E4EVCP1.px` (Non-food & industrial crops) | volume (t) by crop (green beans / dried berries × Arabica/Robusta/Excelsa/Liberica) × 110 geolocations × year × quarter/annual, 2010–2026 | national supply side (not NCR) | PSA open data | free | Pulled CSV: PH green beans 2025 = **35,645.6 t**; Sultan Kudarat 15,689 t; Benguet 1,012 t; Cavite 1,230 t | Province choropleth / "where Manila's beans come from" flow map |
| 8 | **PSA Philippine Statistical Yearbook Table 13.2** `0022H2BLRT0.px` – rail passengers by line × month | LRT-1, LRT-2, MRT-3 monthly passengers (millions), load factor, farebox revenue, 2023–2024 | line-level, not station-level | PSA open data | free | Pulled CSV: LRT-1 Dec 2024 = 11.70 M pax; LRT-2 2024 = 53.29 M | Monthly ridership seasonality vs café openings; line-corridor weighting |
| 9 | **LRTA Annual Accomplishment Report CY2024 (PDF)** | LRT-2 total/daily/peak ridership, monthly table, train capacity | LRT-2 only | government publication | free | p.38–40: daily average **147,202** (2024), peak 206,817 on 6 Dec 2024; monthly 2023 vs 2024 series | Corridor foot-traffic proxy for Recto–Antipolo (Katipunan/Ateneo, Cubao, Gilmore) |
| 10 | **Overpass API context counts (OSM)** | counts (and geometries if needed) of coworking, hotels, apartments, offices, universities, rail stations, malls, cafés | NCR totals: coworking 20, hotels 592, building=apartments 3,578, office=* 3,816, universities/colleges 424, railway=station 106, malls 265, amenity=cafe 2,044, shop=coffee 42, office/commercial buildings 3,370 | ODbL | free | query file `raw/ov2.ql` against `overpass-api.de/api/interpreter` | Café density normalised by offices / condos / campuses per district (hex-bin ratio map) |
| 11 | **ICO Coffee Market Report (monthly PDF)** `ico.org/documents/cy2025-26/cmr-MMYY-e.pdf` | I-CIP composite and 4 group indicators (US c/lb), exports, stocks | global price context | ICO publication, citable | free | `cmr-0926-e.pdf` p.1: I-CIP Sep 2026 **262.18 c/lb**, Robustas 167.49, Colombian Milds 356.15 | Green-coffee price line vs Manila retail bean prices (Shopify data) |
| 12 | **PAGASA Climatological Normals** page (HTML table) | monthly rainfall normals (mm) for 50+ synoptic stations incl. NAIA, Port Area, Science Garden | 3 NCR stations | DOST-PAGASA public | free | Science Garden QC: Jul 493.3 mm, Aug 504.2 mm, annual 2,574.4 mm; NAIA annual 1,767.8 mm | Rain-season context strip under any monthly café/opening chart (complements Open-Meteo) |
| 13 | **Google Open Buildings v3** (CC BY 4.0 / ODbL) | building polygons with confidence + area; S2 level-4 tiles | Manila falls in tile **339** (1,433.6 MB gz) | CC BY 4.0 (also offered under ODbL) | free | `https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/339_buildings.csv.gz` (from `tiles.geojson` on the appspot host) | Built-up density grid; cafés per 1,000 buildings |
| 14 | **Foursquare OS Places (HF, Apache-2.0)** | `fsq_place_id, name, lat/lon, address, categories, date_created, date_refreshed, date_closed, website, tel, instagram…` (schema verified on docs.foursquare.com) | PH rows present (global dataset, ~100M+) – count UNVERIFIED (gated) | Apache-2.0; gated "auto" – accept form (org, title, country, use) → instant access | free | HF API: `gated:"auto"`, configs `places`, `categories`, `deltas` at `release/dt=2026-10-15/`; `datasets-server` returns 401 without token. Steps: create HF account → open dataset page → tick "I agree" → `huggingface-cli login` → `pip install datasets` → `load_dataset("foursquare/fsq-os-places","places", streaming=True)` filter `country=="PH"` | Café openings/closures timeline from `date_created`/`date_closed` (the only legal review-site-like temporal signal) |
| 15 | **Philippine Coffee Expo 2026 exhibitor directories** | exhibitor name (main 25, MSME 4, Roaster Fiesta 11) | national trade | public event listing | free | `philippinecoffeeexpo.com/directory-roaster-fiesta/` → Habitual Coffee, Prism Coffee Roasters, Second Shot, Mangkas… | Roaster map nodes / "who roasts for whom" |
| 16 | **Finder.com Starbucks Index 2019** | tall-latte USD price by city | Quezon City **$2.69** (rank 67, 2019 prices) | © Finder; press use with citation | free | WebFetch confirmed table row | One-point "Manila vs world" latte price callout |
| 17 | **EOG / Colorado School of Mines VIIRS nighttime lights (annual VNL v2.2)** | radiance GeoTIFF | global | free with EOG account (OIDC login verified: directory redirects to `eogauth.mines.edu`) | free (registration) | `eogdata.mines.edu/nighttime_light/annual/v22/2023/` → 302 to login | Night-economy brightness vs late-closing cafés |
| 18 | NASA Black Marble VNP46A4 | annual NTL | global | Earthdata login | free | blackmarble.gsfc.nasa.gov links to Earthdata project page | same as 17 |
| – | CHED enrolment by institution | — | — | — | — | **UNVERIFIED**: ched.gov.ph/statistics/ is behind a Cloudflare managed challenge (403 to curl and WebFetch). Manual path: browser → Statistics → "Higher Education Enrollment by Institution" xlsx. PSA fallback (verified): PSY Table 10.17 `0193E2BHED0.px` (enrolment by discipline, AY 2011–2021; not by institution) | campus-adjacent weighting |
| – | PEZA IT park/centre list | — | — | — | — | **UNVERIFIED**: `/getting-started-category/economic-zone-locator` loads but contains no list (dynamic widget); `/downloads` has only forms | office density |
| – | Broker retail rents (Colliers, KMC Savills, Leechiu, SKF, Lamudi, JLL, Prime) | — | — | — | — | **UNVERIFIED**: Colliers `/en-ph/research` 403 (bot-blocked), Lamudi journal 403, Leechiu `/insights` 404, KMC research page lists only industrial/office-Clark PH items, SKF research page newest Manila item is Q3 2019, Prime Philippines has blog posts only. Need manual browser download of Colliers "Metro Manila Retail Q2/Q3 2026" PDF. | rent vs café density |
| – | MRT-3 / LRT-1 per-station ridership | — | — | — | — | **UNVERIFIED**: dotrmrt3.gov.ph has no statistics page (`/ridership`, `/statistics` 404); LRMC site only news; station-level counts appear only in DOTr-MRT3 Facebook posts and FOI replies. Line-level is covered by #8/#9. | station catchment |
| – | DA/PCB Coffee Industry Roadmap 2021–2025 PDF | — | — | — | — | **UNVERIFIED**: three guessed URLs 404; philcoffeeboard.com member directory and awards pages 404. PSA #7 covers the production-by-province need. | supply map |
| – | Manila Coffee Festival | organiser "Oh, the Places We See" branding on site (2026) | — | — | — | partially verified (site live, exhibitor list not published as data) | event layer |
| – | Coffee Science Center | — | — | — | — | **UNVERIFIED**: coffeesciencecenter.com unreachable (000) | — |
| – | Rockwell Power Plant Mall | — | — | — | — | **UNVERIFIED**: Angular SPA ("The Rockwellist"); no API endpoints visible in main/chunk JS; needs a browser session to capture XHR | — |
| – | QC open data portal | — | — | — | — | dead (`data.quezoncity.gov.ph` no DNS; `/open-data/` 301 loop) | — |

## Ruled OUT by robots/terms (verified)

| Source | Evidence |
|--------|----------|
| SM Supermalls directory | robots.txt `Disallow: /mall-directory/tenants/`, `/search/tenants/`, `/mall-directory/mall-tenants/` — tenant pages explicitly off-limits to crawlers |
| Ayala Malls (Greenbelt, Glorietta, UP Town, Trinoma…) | robots.txt `User-agent: * Disallow: /` |
| Megaworld Lifestyle Malls (Uptown, Venice, Eastwood) | robots.txt `User-agent: * Disallow: /` |
| Wanderlog | Terms: "Use any robot, spider, or other automatic device… to access Service for any purpose, including monitoring or copying" prohibited; ratings are Google-derived anyway |
| Tatler Dining | robots `Disallow: /search`, `Crawl-delay: 10`; search endpoint 404 for PH filter; individual listing pages exist but no structured list – editorial hand-collection only |
| Booky | Cloudflare 530 (origin down) on every request; terms page unreachable |
| Yelp | robots.txt points to ToS; Yelp Fusion API requires key and forbids storing/caching beyond 24 h — not usable for a static viz |
| Shangri-La Plaza | site unreachable (000) |

## Example requests (copy-paste)

```bash
# 1. Ortigas Malls tenant JSON (any of estancia|greenhills|tiendesitas|the-strip)
curl -s https://www.ortigasmalls.com/estancia | grep -o 'data-page="[^"]*"' | python3 -c "import sys,html,json;d=json.loads(html.unescape(sys.stdin.read()[11:-1]));print(len(d['props']['mall_directory']['floors']))"

# 2. Podium stores
curl -s 'https://thepodium.com.ph/wp-json/wp/v2/store?per_page=100&page=1' | python3 -c "import json,sys;print([s['title']['rendered'] for s in json.load(sys.stdin) if 82 in s['store_category']])"

# 6. PSA CPI, NCR coffee + restaurants (PXWeb POST)
curl -s -H 'Content-Type: application/json' --data @raw/cpi_q.json \
  https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2M/PI/CPI/2018NEW/0012M4ACP22.px

# 7. PSA coffee production by province (Annual, green beans)
curl -s -H 'Content-Type: application/json' --data @raw/psa_coffee_q.json \
  https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2E/CS/0072E4EVCP1.px

# 10. Overpass counts
curl -s --data-urlencode 'data@raw/ov2.ql' https://overpass-api.de/api/interpreter

# 11. ICO monthly report
curl -sO http://www.ico.org/documents/cy2025-26/cmr-0926-e.pdf
```

## CSVs saved in this folder

| File | Rows | Content |
|------|------|---------|
| `ortigas_malls_tenants.csv` | 996 | Estancia / Greenhills / Tiendesitas / The Strip tenants with floor, wing, category, `is_cafe_like` |
| `podium_tenants.csv` | 198 | Podium tenants with categories (12 `cafe`) |
| `robinsons_mm_tenants.csv` | 1,659 | 9 Robinsons Metro Manila malls, tenant + floor (parsed from Google Sites; some fragment noise remains) |
| `araneta_city_dining_tenants.csv` | 150 | Araneta City dining tenants with building and floor code |
| `bgc_coffee_pastries_tenants.csv` | 8 unique (15 links) | BHS "Coffee & Pastries" with building/floor |
| `psa_cpi_ncr_coffee_restaurants_2018_2026.csv` | 8 series × 117 months | CPI all items / coffee / restaurants & café, PH and NCR |
| `psa_coffee_green_beans_by_province_2022_2025.csv` | 660 | green-bean output by variety × province, annual 2022–2025 |
| `psa_psy_rail_passengers_by_line_month_2023_2024.csv` | 9 | LRT-1 / LRT-2 / MRT-3 monthly passengers, load factor, revenue |
| `overpass_ncr_context_counts.csv` | 10 | NCR counts of coworking, hotels, apartments, offices, universities, stations, malls, cafés |
| `pagasa_rainfall_normals_ncr.csv` | 3 | monthly rainfall normals for NAIA, Port Area, Science Garden |
| `philippine_coffee_expo_2026_exhibitors.csv` | 41 | exhibitor names by directory |

Caveats: mall "café-like" flags are regex on names (misses e.g. "Single Origin"-style names, catches "Kenny Rogers Roasters"); Robinsons floors occasionally concatenate two entries; BGC list covers only Ayala-managed High Street blocks; the Greenhills JSON includes ~900 tiangge stalls, so filter `category == 'Dining'` before counting.
