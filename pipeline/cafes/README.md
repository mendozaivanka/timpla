# Metro Manila specialty cafés: dataset

Built 2026-10-21 from free, legally reusable sources. Open `report.html` for a map and summary charts.

## Inclusion rules

Three hard rules (all must hold):

1. **Inside Metro Manila**: point-in-polygon against the NCR units (`data/ncr_adm3.geojson`, geoBoundaries ADM3); stated city when there are no coordinates. The *city label* uses the stated city, because geoBoundaries still draws Fort Bonifacio (BGC) and the EMBO barangays inside Makati although the 2022 Supreme Court ruling gave them to Taguig.
2. **Specialty**: roasts its own beans, serves a named specialty roaster or origin, has a brew-method menu, or appears on a roaster stockist list or coffee-festival roster. Chains (Starbucks, CBTL, Bo's, Tim Hortons, Pickup, ZUS, But First Coffee, Dear Joe…) are excluded.
3. **Currently open**: 2025–2026 evidence (own site/menu, press, event roster, active ordering page, OSM check date); anything with closure news is out.

**Recognition is a tier, not a filter** (changed 2026-10-21 so indie and lesser-known cafés are included):

| Tier | Meaning |
|---|---|
| `acclaimed` | 2+ independent editorial write-ups, or an award / World's 100 Best placing |
| `recognised` | 1 write-up, or roaster/award pedigree, or a community signal (festival roster, roaster stockist list, market stall) |
| `indie` | specialty and open, but no press yet |

Google and Foursquare ratings are deliberately absent: their terms forbid storing or displaying them. Foreign specialty brands (Toby's Estate, %Arabica, Common Man, ST. ALi, Kurasu…) are kept and flagged `ownership = foreign brand`.

## The wider directory (added 2026-10-22, PLAN-v2 Option 1)

`scripts/build_directory.py` builds `directory.csv` on top of the specialty layer: every **independent** café in NCR with recent evidence it's open. Specialty becomes a badge (`cls = specialty`, tiers unchanged) instead of the entry rule.

- **Not a café** (removed first): tea/dessert/donut cuisine without coffee, milk tea / internet café names, `amenity=fast_food`, `shop=bakery`, restaurants and bars without a coffee signal, unnamed features, OSM duplicates within 150 m.
- **Chain** (never listed): a name or brand in `data/chains.psv`, or **≥ 10** deduplicated NCR locations under one name across OSM + Overture. **4–9** locations = `multibranch`, kept and labelled. Generic names ("Coffee Spot", "Coffee Corner") are exempt from the count. Specialty-verified shops are never chains.
- **Open evidence**, strongest first: `editorial_2025_26` (specialty layer) > `osm_check` (OSM `check_date`/`survey:date` ≥ 2024) > `overture_2026_09` (same-name Overture place within 150 m with confidence ≥ 0.6, **and** the café's own website/social in OSM or Overture; a page alone failed the 30-row spot-check in `spotcheck_results.psv`: 7 closed/not cafés, 9 untraceable). OSM-only rows with none of these go to `osm_layer.json` (map background, "status unverified").
- Names of shops the specialty layer found closed / not a café / outside NCR are blocked from re-entering as independents.
- Hand exclusions: `data/osm_exclusions.psv` (`osm_id|reason`). Counts and the chain log: `qa_directory.md`.

Run after `build_dataset.py`: `python3 scripts/build_directory.py`. Shared helpers live in `scripts/common.py`. OSM input: `sources/osm_ncr_cafes_meta_2026-10-21.json` from `sources/raw/osm_cafes_meta.ql` (Overpass needs a User-Agent: `curl -A "..." --data-urlencode 'data@sources/raw/osm_cafes_meta.ql' https://overpass-api.de/api/interpreter`). **Licence:** the directory is OSM-derived, so it is ODbL ("© OpenStreetMap contributors").

## Files

| File | What |
|---|---|
| `cafes.csv` | One row per **branch**, every candidate. Filter `included == yes` for those passing the three hard rules; `tier` gives recognition; `exclusion_reasons` says why the rest don't; `source_file` says which discovery file a row came from. |
| `cafes.geojson` | Included branches with coordinates, ready for MapLibre/Leaflet/QGIS. |
| `qa_report.md` | Counts, exclusions by rule, cities, network/timeline stats. |
| `report.html` | Self-contained report: map (OpenFreeMap tiles), bars, tables. |
| `data/editorial_list.psv` | Source list: 216 branch rows, 150 shops, with endorsement sources, status evidence, coordinates and their provenance. |
| `data/timeline.psv` | 143 dated events (opened / closed / moved / rebranded / reopened) with evidence URL and confidence. "low" usually means an upper bound ("operating by…"). |
| `data/roaster_edges.psv` | 90 café→roaster relations (own_roast, serves, roasted_by, wholesale_stockist, host_venue). |
| `data/origins.psv` | 318 bean listings from roasters' own shops with origin place, province, process, weight, price. |
| `data/awards_events.psv` | 123 rows: PCQC winners 2017–2026, national barista/brewers/latte-art champions and their cafés, festival and expo editions. |
| `data/bean_prices_per250g.csv`, `data/shopify_products.csv` | Normalised bean prices (PHP per 250 g) and raw Shopify product dumps (12 stores). |
| `sources/` | OSM dump of all 2,314 NCR cafés (ODbL), Starbucks PH store list (538), Yardstick menu PDFs. |
| `scripts/` | `build_dataset.py` (rules → cafes.csv/geojson/qa), `make_report.py` (report.html), `geocode_gaps.mjs` (Nominatim fallback). |

Re-run from the project folder: `python3 scripts/build_dataset.py && python3 scripts/make_report.py`. Extra discovery files go in `data/` as `indie_*.psv` (same columns as `editorial_list.psv`, plus optional `community_signals`); status corrections go in `data/status_updates.psv`.

## Extra sources (`extra/`)

Verified live on 2026-10-21; details, example requests and the ruled-out list are in `extra/extra_sources.md`.

| Source | Pulled to | Enables |
|---|---|---|
| Ortigas Malls directory JSON (Estancia, Greenhills, Tiendesitas, The Strip): 996 tenants with floor, wing, category | `ortigas_malls_tenants.csv` | Floor-by-floor "where cafés sit in a mall"; chain vs independent share per mall |
| The Podium (WP REST), Robinsons Malls directory (9 NCR malls, 1,659 rows), Araneta City dining (150), BGC "Coffee & Pastries" (15) | `podium_tenants.csv`, `robinsons_mm_tenants.csv`, `araneta_city_dining_tenants.csv`, `bgc_coffee_pastries_tenants.csv` | Same, across more malls; café flags are name-based, so review before publishing |
| PSA OpenSTAT: CPI by commodity × region (NCR "Restaurants, café" 129.8 vs coffee at home 116.9 vs all items 125.4, 2025), coffee production by province (Sultan Kudarat 15,689 t, Benguet 1,012 t in 2025), LRT/MRT monthly passengers 2023–24 | `psa_*.csv` | Café-sector inflation line; supply-flow map province → roaster; ridership context |
| Overpass context counts for NCR (offices 3,816, condos 3,578, universities 424, rail stations 106, malls 265, hotels 592, coworking 20) | `overpass_ncr_context_counts.csv` | Density-normalised café maps (per office, per campus) instead of raw counts |
| PAGASA rainfall normals (NAIA, Port Area, Science Garden); ICO monthly price report (I-CIP Sep 2026: 262 US¢/lb); Philippine Coffee Expo 2026 exhibitor and roaster lists (41) | `pagasa_rainfall_normals_ncr.csv`, `philippine_coffee_expo_2026_exhibitors.csv` | Seasonality strip; green-coffee price context; roaster universe check |
| Foursquare OS Places (Apache-2.0, Hugging Face, gated by a free login): `date_created` / `date_closed` per place | not pulled (needs your HF login) | Independent openings/closures timeline for all NCR cafés |

Ruled out by robots/terms or unreachable: SM Supermalls tenant pages, Ayala Malls, Megaworld malls, Wanderlog, Yelp, Booky (down), CHED statistics (browser-only), broker rent PDFs (Colliers/Lamudi 403; download by hand), per-station rail ridership (not published).

## Discovery files and credits

- `data/indie_osm.psv`: independent cafés vetted from OpenStreetMap (© OpenStreetMap contributors, ODbL). Triage log in `sources/osm_indie_pruned.txt`.
- `data/indie_neighbourhoods.psv`: indie cafés found by neighbourhood guides, festival lineups (KapeCon 2025/2026, Philippine Coffee Expo 2026 Roaster Fiesta, SM Mega Coffee Fest and Brewtopia 2026) and roasters' stockist lists. Marikina rows draw on the **Marikina Local Coffee Shop Directory** — required credit: "Data from the Marikina Local Coffee Shop Directory (https://marikina-cafes.vercel.app), licensed CC BY 4.0."
- `manual_check.md`: cafés that need a human look (Instagram or a visit): specialty-but-status-unknown, open-but-specialty-unconfirmed, and specialty-but-location-unknown.

## Known limits

- **Status "unclear" is the biggest filter**: shops with no 2025–26 evidence either way are excluded, not closed (see `data/status_updates.psv` for what was checked). A manual pass (their Instagram, or a visit) would recover some.
- Editorial coverage skews to Makati/BGC/QC; northern NCR is thin in both press and OSM.
- 8 included branches have no coordinates (address was city-only).
- Opening years: 93 of 109 branches have one; "low"-confidence years are upper bounds.
- Prices drift (Yardstick +20% 2022→2026); every price row carries its source URL and fetch date.
- Licences: OSM data is ODbL (credit "© OpenStreetMap contributors"); editorial facts are cited per row; cafés' own product data is public but don't republish raw dumps wholesale.
