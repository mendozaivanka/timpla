# PLAN-v2.md: Earth Engine layers for Timpla, and a wider inclusion rule

Status: plan only, nothing built. Written 2026-10-22 against `cafe-data/` (109 shops / 174 branches included), `tala-portfolio/scripts/build-timpla-data.ts` (writes `src/data/timpla/*.json`) and the Timpla pages (`/timpla/`, `/timpla/map/`, `/timpla/cafes/`, `/timpla/data/`). Constraints kept throughout: zero cost, free/open data only, no Google Places or Foursquare ratings, static site on Render, honest framing.

Everything marked **VERIFIED** was read on the cited page today. **UNVERIFIED** means it comes from memory or a secondary page and must be checked before it is printed on the site.

---

## PART 1: Google Earth Engine for Timpla

### 1.1 Can Ivanka use Earth Engine for free, and publish the results?

| Question | Answer | Status |
|---|---|---|
| Is a free noncommercial project still available in 2026? | Yes. Eligible groups include "an individual developer using Earth Engine for noncommercial purposes" (plus nonprofits, academics, journalists). You register a Google Cloud project as noncommercial; billing is not required for the default tier. | VERIFIED (earthengine.google.com/noncommercial) |
| Quota | Since **2026-04-27** noncommercial projects get a monthly EECU budget: **Community tier 150 EECU-hours/month** (default, no requirements), **Contributor tier 1,000 EECU-hours/month** (needs a billing account attached, but noncommercial EE usage is not charged), Partner tier 100,000 (application, climate/nature projects only). Resets on the 1st, Pacific time; over quota → "restricted mode" (throttled), not a hard cut-off. | VERIFIED (developers.google.com/earth-engine/guides/noncommercial_tiers) |
| Other limits | 40 concurrent requests, 100 requests/s, ~2 concurrent batch tasks, 10 MB request payload, 100 MiB aggregation result, 250 GB / 10,000 assets. | VERIFIED (guides/usage) |
| Is Timpla "noncommercial"? | The terms exclude "using the Services to sell a product or service" and charging for applications or data made with EE. Timpla is a free, unmonetised site. A portfolio that helps someone get hired is not a sale of a product; if Timpla ever carries ads, sponsorship or paid listings, this stops being true. | VERIFIED wording (earthengine.google.com/terms §2.1); the portfolio reading is my judgement |
| May derived results go on a public website? | The terms say the customer "can use data, diagrams, charts, figures created by use of the Services in research" and that the customer owns Customer Data/Applications; the API terms add that applications and data "cannot be sold or licensed for a fee". No clause forbids publishing free outputs, and journalists are an explicitly eligible group, but **publication on a public website is not addressed in so many words**. | VERIFIED quotes; the "allowed" conclusion is an inference, UNVERIFIED as explicit text |
| Attribution | Earth Engine itself imposes no attribution line; each dataset's own licence does (CC BY 4.0, Copernicus notices, "courtesy USGS"). Print both: "Computed in Google Earth Engine from [dataset, licence]". | VERIFIED (terms §4.4 defers to third-party licences) |

How much compute Timpla needs: NCR is ~620 km². At VIIRS resolution that is ~3,000 pixels; at Landsat 30 m ~700,000 pixels; a three-season Landsat median plus a dozen zonal reductions is minutes of EECU, not hours. Every idea below fits comfortably inside the 150 EECU-hour Community tier even if re-run monthly (order-of-magnitude estimate, UNVERIFIED).

**What Ivanka must set up herself (≈30 min, once):**
1. Google account → Google Cloud console → new project (e.g. `timpla-gee`); no billing account needed.
2. Register it at code.earthengine.google.com/register as **noncommercial / individual**, pick the Community tier; enable the "Google Earth Engine API" on the project.
3. Locally: `pip install earthengine-api`, `earthengine authenticate` (browser OAuth), then `ee.Initialize(project="timpla-gee")`.
4. Upload the zonal polygons once through the Code Editor's asset uploader (zipped shapefile or CSV; no Cloud Storage bucket needed): the NCR units from `data/ncr_adm3.geojson` and, if idea C is built, the NCR barangays. The alternative, passing GeoJSON inline as `ee.FeatureCollection`, also works because the file is under the 10 MB payload cap, but assets are faster and reusable.
5. Optional, only if she wants a GitHub Action to refresh artefacts: create a service account, register *that account* for Earth Engine too, store its JSON key as a repo secret, `ee.ServiceAccountCredentials(email, key_file)`. Recommendation: **don't**. These datasets change yearly; run the scripts by hand, commit the small artefacts, keep zero secrets in CI.

### 1.2 Dataset shortlist (all free; catalog pages checked 2026-10-22)

| Dataset (EE ID) | Res. | Range | Licence | What it adds to Timpla |
|---|---|---|---|---|
| VIIRS nightlights, annual `NOAA/VIIRS/DNB/ANNUAL_V22` | 464 m | 2012–2024 (annual; page shows 2012-04 to 2025-01) | Public domain (Colorado School of Mines EOG) | "Do cafés follow the lights?" city- and cluster-level radiance change 2014→2024; bands `average_masked`, `median_masked`, `cf_cvg` |
| VIIRS nightlights, monthly `NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG` | 464 m | 2014-01 → 2026-08 | Public domain | Monthly series to pair with the openings timeline; `avg_rad`, `cf_cvg` (monsoon months have few clear nights) |
| Dynamic World `GOOGLE/DYNAMICWORLD/V1` | 10 m | 2015-06 → present | CC BY 4.0 (credit Google / NatGeo / WRI) | Per-image class probabilities (`built`, `trees`, `crops`…): land-cover change 2016→2025 in NCR and in coffee municipalities; tree cover around cafés |
| ESA WorldCover `ESA/WorldCover/v200` | 10 m | 2021 (single year) | CC BY 4.0 | Clean one-off land-cover baseline (11 classes); less noisy than a single DW composite |
| GHSL built-up surface `JRC/GHSL/P2023A/GHS_BUILT_S` | 100 m | 1975–2030, 5-yearly | EC JRC, free with acknowledgement | Built-up m² per cell per epoch: urban growth background and a density denominator; `built_surface_nres` ≈ non-residential (offices/commerce) |
| GHSL population `JRC/GHSL/P2023A/GHS_POP` | 100 m | 1975–2030, 5-yearly (2025/2030 are projections) | EC JRC | Residents per cell for cafés-per-10k-people by barangay or hex |
| GHSL building height `JRC/GHSL/P2023A/GHS_BUILT_H` | 100 m | 2018 | EC JRC | Average building height = cheap "CBD-ness" proxy |
| GHSL degree of urbanisation `JRC/GHSL/P2023A/GHS_SMOD_V2-0` | 1 km | 1975–2030 | EC JRC | Urban centre / dense cluster / suburban classes for origin provinces (towns vs farms) |
| Google Open Buildings v3 `GOOGLE/Research/open-buildings/v3/polygons` | polygons | May 2023 inference | CC BY 4.0 | Building footprints with `confidence`, `area_in_meters`; Philippines is in the country list (VERIFIED on the project FAQ) |
| Open Buildings 2.5D Temporal `GOOGLE/Research/open-buildings-temporal/v1` | 4 m effective (0.5 m rasters) | 2016–2023 annual | CC BY 4.0 **or** ODbL (your choice) | `building_presence`, `building_height`, `building_fractional_count` per year: watch BGC / Bridgetowne / Arca South fill in; Philippines covered (VERIFIED on project page) |
| WorldPop `WorldPop/GP/100m/pop` | ~93 m | 2000–2020 | CC BY 4.0 | Second population denominator (cross-check GHS_POP) |
| Landsat 8/9 L2 `LANDSAT/LC08/C02/T1_L2`, `LANDSAT/LC09/C02/T1_L2` | 30 m (thermal native 100 m, resampled) | 2013→ / 2021-10→ present, 16-day each (8-day combined) | Public domain, credit USGS | Land surface temperature: `ST_B10 × 0.00341802 + 149` K; cloud mask from `QA_PIXEL` bits 1–4 |
| MODIS LST `MODIS/061/MOD11A2` (Terra), `MODIS/061/MYD11A2` (Aqua) | 1 km | 2000/2002 → present, 8-day | No restrictions (LP DAAC) | Day and night LST (`LST_Day_1km`, `LST_Night_1km`, ×0.02 K) for a monthly heat cycle and night-time heat island |
| ERA5-Land monthly `ECMWF/ERA5_LAND/MONTHLY_AGGR` | 11 km | 1950 → 2026-09 | Copernicus C3S licence: print "Generated using Copernicus Climate Change Service information [year]" | 2 m air temperature and dew point (humidity) per origin province; too coarse for intra-NCR work |
| CHIRPS rainfall `UCSB-CHG/CHIRPS/PENTAD`, `UCSB-CHG/CHIRPS/DAILY` | 5.5 km | 1981 → 2026-09 | Public domain (CC0 waiver) | Rainfall climatology per origin province; NCR wet/dry season strip |
| TerraClimate `IDAHO_EPSCOR/TERRACLIMATE` | 4.6 km | 1958 → 2024-12 monthly | CC0 | `tmmx`/`tmmn` (×0.1 °C), `pr`, `pet`, `def`, `vpd`: the cleanest province climate summary for "Arabica weather" |
| Copernicus DEM `COPERNICUS/DEM/GLO30_2024_1` (the older `GLO30` is deprecated) | 30 m | 2010–2020 acquisitions | Free worldwide licence, requires the Copernicus/DLR/Airbus notice | Elevation bands per province and per named origin municipality; note it is a *surface* model (canopy adds metres) |
| SRTM `USGS/SRTMGL1_003` | 30 m | Feb 2000 | Public domain | Simpler-licence fallback for the same elevation bands |
| Sentinel-2 SR `COPERNICUS/S2_SR_HARMONIZED` + `GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED` | 10 m | 2017-03 → present | Copernicus Sentinel terms (free use and redistribution with credit) | NDVI around cafés; dry-season true-colour chips for story pages |
| Hansen Global Forest Change `UMD/hansen/global_forest_change_2025_v1_13` (v1.12 is deprecated) | 30 m | tree cover 2000; loss by year 2001–2024 (v1.13 may extend to 2025: UNVERIFIED) | CC BY 4.0 | Forest loss in coffee municipalities; cannot say *why* |
| geoBoundaries ADM2 `WM/geoLab/geoBoundaries/600/ADM2` | vector | CGAZ v6 (2023) | CC BY 4.0 | Philippine provinces (`shapeGroup == "PHL"`) as zonal units without an upload; **name matching to PSA province names must be checked** (UNVERIFIED) |
| FAO GAUL `FAO/GAUL/2025/level2` | vector | 2025 | **Noncommercial only** | Avoid: more restrictive than needed; geoBoundaries does the job |
| HDX COD-AB Philippines (barangays, ADM4) | vector | PSGC 2023 pcodes, reviewed 2024 | HDX / OCHA, CC BY-style | Not in EE; download from HDX (`cod-ab-phl`, the SHP zip is ~880 MB, so trim to NCR locally with mapshaper before upload). Barangay layer exists per the HDX record (~42,048 features nationally); the HDX page blocked my fetch today, so treat the exact file as UNVERIFIED |

Zonal unit advice: barangays in NCR (~1,700; Manila alone has ~900 tiny ones, UNVERIFIED count) are wildly unequal in area, so the choropleth lies unless normalised. Use a **500 m grid or H3 resolution-8 hexagons (~0.74 km², ≈900 cells for NCR)** as the primary analysis unit and barangay/city as the label layer. The 17 NCR LGUs (`ncr_adm3.geojson`, dissolve Manila's 16 districts) remain the unit for the bar charts.

### 1.3 Visualisation ideas (ranked)

Common output rules: everything is precomputed into `cafe-data/extra/gee/` as small JSON (tables, ≤ 60 KB each) or 8-bit palette PNG overlays (NCR at 100 m is 270 × 500 px ≈ 60–120 KB; at 30 m ≈ 900 × 1,670 px ≈ 0.4–1 MB, so ship 30 m only for the heat map and only on that page). PNGs come from `ee.Image.getThumbURL({region, dimensions, format:"png", palette})`; anything larger than a couple of thousand pixels per side goes through `Export.image.toDrive` instead (exact thumbnail cap UNVERIFIED). Overlays are placed in MapLibre with an `image` source and the four corner coordinates; no tiles, no COG server. Café inputs come from `cafes.geojson` (174 branches, 160 with coordinates) and, for all-café comparisons, the OSM dump (ODbL).

| # | Idea | Rank |
|---|---|---|
| A | Do cafés follow the lights? | 1 |
| E+G | Origins: altitude and rain of the provinces on the menu | 2 |
| C | Built-up, people and coffee deserts | 3 |
| B | Hot city, iced coffee (urban heat) | 4 |
| H | Green cup: tree cover around cafés | 5 |
| J | New districts, new cafés (Open Buildings 2.5D) | 6 |
| D | Lights before or after the opening? (event study) | 7 |
| F | Forest loss in coffee municipalities | 8 |

**A. Do cafés follow the lights? (rank 1; 5–7 h)**
- Question: Are specialty cafés in the places that were already bright in 2014, or in the places that brightened most since? Where in NCR are the dark gaps (north: Caloocan, Malabon, Navotas, Valenzuela; south: Las Piñas) relative to cafés?
- Datasets: `NOAA/VIIRS/DNB/ANNUAL_V22` (`median_masked`, `cf_cvg`), optional monthly `VCMSLCFG` for a 2014–2026 line.
- Computation: for each year 2014…2024 take the annual image, mask `cf_cvg < 10`; (i) `reduceRegions(reducer=mean, scale=464)` over the 17 LGUs and over the H3 hexes; (ii) `sampleRegions` at the 160 café points and at the ~2,150 OSM café nodes, plus a 5,000-point random sample of NCR land, giving three radiance distributions; (iii) change raster `(2024 − 2014) / 2014` clipped to NCR. Index city series to 2014 = 100.
- Outputs: `gee/lights_by_city.json` (17 × 11 numbers), `gee/lights_hex.json` (~900 hexes × 3 years, ≈ 30 KB), `gee/lights_at_cafes.json` (160 rows: radiance 2014/2019/2024, NCR percentile), `gee/lights_change_2014_2024.png` (NCR at 464 m upscaled, labelled "464 m pixels").
- Charts: small-multiple indexed lines per city (one series each, rose for the cities with cafés, grey for the six zero-café cities); a strip plot "radiance at specialty cafés vs all OSM cafés vs NCR at large" (three strips, median ticks); the change raster as a muted overlay on `/timpla/map/` behind the pins, with a toggle.
- Caveats to print: VIIRS DNB does not saturate like DMSP but radiance plateaus in dense CBDs, so Makati CBD/BGC differences are compressed; monsoon months have few cloud-free nights (annual composites help; use `cf_cvg`); light measures electricity and commerce, not coffee; V22 starts 2012 but is consistent from 2014; correlation only.

**E+G. Origins: altitude and rain of the provinces on the menu (rank 2; 6–8 h)**
- Question: Manila roasters list Benguet most (38 listings) while Sultan Kudarat grows 15× more beans. What do those places look like, in altitude and in weather, and where do the Arabica-friendly elevations actually lie?
- Datasets: `COPERNICUS/DEM/GLO30_2024_1` (`DEM`), `IDAHO_EPSCOR/TERRACLIMATE` (`tmmx`, `tmmn`, `pr`, 1991–2020), `UCSB-CHG/CHIRPS/PENTAD` (1991–2020 climatology), provinces from `WM/geoLab/geoBoundaries/600/ADM2` filtered to PHL, named origin municipalities (Atok, Tublay, Bansalan, Pangantucan, Sigay, Senator Ninoy Aquino…) from HDX COD-AB ADM3 if the geoBoundaries names don't match.
- Computation: per province (the 11 with listings + the top PSA producers): `reduceRegion(ee.Reducer.frequencyHistogram)` of the DEM binned to 0–600 / 600–1,000 / 1,000–1,500 / 1,500+ m at 90 m scale (share of land per band); `reduceRegion(mean)` of TerraClimate monthly tmmx/tmmn → annual mean and coolest-month mean; CHIRPS monthly means → 12-value rainfall curve, count of months < 60 mm (dry months). Same for the named municipalities.
- Outputs: `gee/origins_elevation.json`, `gee/origins_climate.json` (both a few KB), optional `gee/hillshade_<province>.png` strips at 90 m (≈ 100 KB each) for the Beans page masthead.
- Charts: stacked horizontal bars of elevation-band shares per province, ordered by listings, with the Arabica band (1,000–2,000 m) highlighted and PSA tonnage printed beside; small-multiple monthly rainfall bars per province with dry months hatched, next to the existing PAGASA NCR strip; a dumbbell "coolest-month mean temperature" Benguet vs Sultan Kudarat vs Bukidnon.
- Caveats: the elevation bands for Arabica vs Robusta are general tropical agronomy (Arabica ~1,000–2,000 m, Robusta below ~800 m), not Philippine-verified thresholds (UNVERIFIED; cite the Philippine Coffee Roadmap or a DA source before printing numbers); province averages describe land, not farms; GLO30 is a surface model (forest canopy adds height); CHIRPS and TerraClimate are 4–5 km products with sparse gauges in the Cordillera; coffee quality depends on far more than altitude.

**C. Built-up, people and coffee deserts (rank 3; 7–9 h incl. barangay prep)**
- Question: Per resident and per hectare of building, where is specialty coffee thick, where is it absent although people and buildings are there ("coffee deserts"), and does café density track offices (non-residential built-up, tall buildings) rather than homes?
- Datasets: `JRC/GHSL/P2023A/GHS_POP` (2020, plus 2025 projection), `JRC/GHSL/P2023A/GHS_BUILT_S` (`built_surface`, `built_surface_nres`, 2020/2025), `JRC/GHSL/P2023A/GHS_BUILT_H` (2018), `GOOGLE/Research/open-buildings-temporal/v1` 2023 (`building_fractional_count`, `building_height`) as the finer cross-check, `WorldPop/GP/100m/pop` 2020 as a second population source.
- Computation: `reduceRegions(sum, scale=100)` of population, built m², non-res built m², `reduceRegions(mean)` of height, over H3 hexes and barangays; join café counts (specialty branches; and all OSM independents from Part 2) per cell; derive cafés per 10k residents, cafés per km² built, and the desert flag: population ≥ 20,000 within the hex's 1 km neighbourhood and zero cafés. Scatter non-res share vs café count.
- Outputs: `gee/density_hex.json` (~900 rows × 8 fields ≈ 60 KB), `gee/density_barangay.json`, `gee/deserts.json` (a short ranked list).
- Charts: a hex choropleth (rosas ramp, 5 classes) with a measure toggle (per 10k residents / per km² built / raw); a log-log scatter of residents vs cafés per hex with the deserts labelled; the city bars already planned in PLAN §3.6 gain the GHS denominators.
- Caveats: GHS_POP is residential (night-time) population; daytime population is what cafés serve and no free global layer gives it, so `built_surface_nres` and height stand in for it; 2025 GHS values are projections from the 2020 census; 100 m cells vs 1,700 unequal barangays; a hex with zero cafés is an observation about our data too (northern NCR is thin in OSM and press).

**B. Hot city, iced coffee (rank 4; 6–8 h)**
- Question: Cafés cluster in the hottest built-up parts of the metro; how much hotter is the ground at a Makati café than NCR's median, and does the night-time heat island line up with where cafés are?
- Datasets: `LANDSAT/LC08/C02/T1_L2` + `LANDSAT/LC09/C02/T1_L2` (`ST_B10`), `MODIS/061/MYD11A2` (`LST_Day_1km`, `LST_Night_1km`), optional Ermida et al. 2020 statistical mono-window module (open code, `sofiaermida/Landsat_SMW_LST`) if the L2 product is judged too coarse.
- Computation: Landsat scenes over NCR, March–May 2023/2024/2025, `QA_PIXEL` bits 1–4 masked, `ST_B10 × 0.00341802 + 149 − 273.15` → median °C at 30 m; `sampleRegions` at café points and at OSM cafés; `reduceRegions(mean)` per hex and LGU; MODIS Aqua day/night monthly means per LGU for the seasonal cycle. Report LST anomaly (cell − NCR median), not absolute degrees.
- Outputs: `gee/lst_dry_season.png` (30 m, NCR, palette, ≈ 0.5–1 MB, lazy-loaded on the story page only), `gee/lst_hex.json`, `gee/lst_at_cafes.json`, `gee/lst_monthly_by_city.json`.
- Charts: overlay with pins; strip plot "LST anomaly at specialty cafés vs all cafés vs NCR"; 12-month day/night lines per LGU (one series per panel, no dual axis).
- Caveats: land *surface* temperature (roofs and asphalt), not the air temperature people feel; dry-season clear-sky scenes only, so it is a "worst case" snapshot; Landsat thermal is native 100 m, resampled to 30 m; the dependence runs through urban form (cafés are where roofs are), so the honest headline is "cafés sit in the hottest fabric", never "heat drives cafés"; MODIS 1 km smears Makati into Pasay.

**H. Green cup: tree cover around cafés (rank 5; 3–4 h)**
- Question: Which café neighbourhoods are leafy (Legazpi Village, Salcedo, Poblacion vs BGC, Ortigas)?
- Datasets: `GOOGLE/DYNAMICWORLD/V1` (`trees` probability, 2025 mean), or `COPERNICUS/S2_SR_HARMONIZED` NDVI (B8, B4; Cloud Score+ `cs_cdf ≥ 0.6`, 2025 dry-season median); `ESA/WorldCover/v200` tree-cover class as the 2021 check.
- Computation: `reduceRegions(mean, scale=10)` over 300 m buffers of each café point (`ee.Feature.buffer(300)`), and per neighbourhood polygon if we draw them (we have neighbourhood names, not polygons; use the buffer union instead).
- Outputs: `gee/greenness_at_cafes.json` (160 rows), `gee/greenness_by_nb.json`.
- Charts: ranked dot strip by neighbourhood; per-shop "tree cover within 300 m" line on the receipt card. Low effort, high charm.
- Caveats: a 300 m circle captures parks and medians, not the café's terrace; DW probabilities are per-image and noisy over dense cities; 10 m pixels mix tree crowns and streets.

**J. New districts, new cafés (rank 6; 4–5 h)**
- Question: In BGC, Bridgetowne, Arca South, Circuit Makati and Vertis North, did buildings come first and cafés after, and by how many years?
- Datasets: `GOOGLE/Research/open-buildings-temporal/v1` (2016–2023: `building_presence`, `building_height`), `JRC/GHSL/P2023A/GHS_BUILT_S` (1990–2025 for the longer run), café opening years from `data/timeline.psv` (113 of 174 branches have one).
- Computation: per district box (2 × 2 km), per year, `reduceRegion(mean)` of `building_presence > 0.5` and of height; thumbnails at 4 m (500 × 500 px per year, ≈ 50 KB each, 8 frames per district).
- Outputs: `gee/districts_growth.json`, `gee/frames/<district>_<year>.png`.
- Charts: a filmstrip (static frames, no autoplay under reduced motion) with café opening years ticked underneath; one line per district of built fraction with opening dots.
- Caveats: `building_presence` is an uncalibrated confidence (relative use only); the series ends in 2023; opening years are partly upper bounds ("by 2016").

**D. Lights before or after the opening? (rank 7; 3–4 h on top of A)**
- Question: For cafés with a known opening year, did the 1 km around them brighten before the opening (cafés follow growth) or after (cafés precede it)?
- Datasets: `NOAA/VIIRS/DNB/ANNUAL_V22`, `data/timeline.psv`.
- Computation: 1 km buffer mean radiance per year per café; re-index each series to "years since opening" (−5…+5); median and interquartile band.
- Outputs: `gee/lights_event_study.json`.
- Charts: spaghetti + median line, counts per offset printed. Exploratory; n ≈ 90 and radiance composites are noisy, so this is a story aside, not a claim.
- Caveats: n small; composite year-to-year noise is comparable to the effect; selection (press-covered cafés open in already-growing places); no causal reading.

**F. Forest loss in coffee municipalities (rank 8; 5 h)**
- Question: Has tree cover fallen in the municipalities whose coffee Manila drinks (Atok, Bansalan, Pangantucan, Senator Ninoy Aquino, Sigay)?
- Datasets: `UMD/hansen/global_forest_change_2025_v1_13` (`treecover2000 > 30`, `lossyear`), `GOOGLE/DYNAMICWORLD/V1` 2016 vs 2025 class shares.
- Computation: `reduceRegion(sum, scale=30)` of loss pixels per year per municipality → hectares; DW `trees`/`crops` share change.
- Outputs: `gee/forest_loss_by_muni.json`.
- Charts: small-multiple columns of hectares lost per year per municipality.
- Caveats, and why it is last: Hansen cannot attribute loss to coffee; shade-grown coffee under canopy is invisible to it; the chart would invite a "coffee destroys forests" reading Timpla cannot support with these data. Build only inside a story that explains this, or not at all.

### 1.4 Pipeline sketch

```
cafe-data/
  scripts/gee/
    _common.py        ee.Initialize(project=…), NCR/H3 geometry helpers, write_json(), thumb()
    lights.py         idea A (+ D)         → extra/gee/lights_*.json, lights_change_2014_2024.png
    origins.py        idea E+G             → extra/gee/origins_*.json, hillshade_*.png
    density.py        idea C               → extra/gee/density_*.json, deserts.json
    heat.py           idea B               → extra/gee/lst_*.json, lst_dry_season.png
  extra/gee/
    manifest.json     per artefact: dataset IDs, bands, date window, scale, reducer, run date, licence line
    *.json, *.png
```

- Each script is a plain `earthengine-api` Python file run locally (`python3 scripts/gee/lights.py`), synchronous (`.getInfo()` on `reduceRegions` results under the 100 MiB cap; thumbnails via `getThumbURL` + `urllib`), idempotent, and writes the `manifest.json` entry so `/timpla/data/` can print the exact provenance without anyone retyping it.
- `tala-portfolio/scripts/build-timpla-data.ts` gains one block: read `extra/gee/manifest.json`, copy the JSONs it lists into `src/data/timpla/gee/` (committed, like the rest) and the PNGs into `public/timpla/gee/`. Charts stay build-time SVG per PLAN §3; the overlays are optional `image` sources in `CafeMap.tsx` behind a toggle, loaded only when switched on.
- Attribution lines, rendered under each chart and listed on `/timpla/data/`: "Computed in Google Earth Engine. Nightlights: NOAA/Colorado School of Mines EOG VIIRS DNB annual V2.2 (public domain). Population and built-up: European Commission JRC GHSL R2023A (reuse with acknowledgement). Elevation: Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA. Climate: TerraClimate (CC0), CHIRPS (public domain). Landsat courtesy of the U.S. Geological Survey. Dynamic World © Google, NatGeo, WRI (CC BY 4.0)." Trim to the datasets actually used.
- Honesty block on `/timpla/data/` (copy the caveats above verbatim), plus one line that Earth Engine was used under its noncommercial terms and that Timpla carries no advertising.

### 1.5 Recommendation for the first iteration

Build **A (lights)** and **E+G (origins: altitude and rain)** first, roughly 12–15 hours together. A gives the map and the places page a time dimension that the café data alone cannot (2014→2024), uses public-domain data with no attribution headaches, and its caveats are easy to state. E+G is the cheapest, uses CC0/public-domain climate data, and turns the Beans page's best insight (Benguet on the menu, Sultan Kudarat in the fields) into something you can see. C is the strongest analytically but needs the barangay/hex prep that Part 2 also needs, so schedule it with Part 2. B is the catchiest headline and the easiest to misread; do it third or fourth with the "surface, not air" caveat printed in the chart subtitle.

---

## PART 2: Revised inclusion criteria

### 2.1 What the measurements say

- Current rule (NCR + specialty + open 2025–26): **109 shops / 174 branches**.
- OSM NCR: 2,314 café-ish features → chain by `brand` tag 615, chain by name list 266, chain-like (≥4 same-name) 33, milk tea/tea 304, unnamed 57, **independent 1,039** (1,009 with coordinates). Freshness: `check_date` ≥2024 on 164, ≥2025 on 124; `opening_hours` 250; website/Instagram 104; `cuisine=coffee_shop` 196, no cuisine 750.
- Overture 2026-09-23.1: 12,571 rows (cafe 4,463 / coffee_shop 7,132 / tea_room 975 / roastery 1); 96.7 % from Meta pages; no operating status, no real freshness; non-chain cafe+coffee_shop 9,624, of which 3,525 at confidence ≥0.6.
- Cross-source: 282 of the 1,009 OSM independents have an Overture name match within 150 m (labelled cafe 102 / coffee_shop 180). OSM independents corroborated by Overture **or** `check_date` ≥2024: **374**.
- Conclusion on Ivanka's suggestion: the Overture `cafe` vs `coffee_shop` label does **not** separate small cafés from chains (most corroborated independents are `coffee_shop`), and Meta's own categories are owner-chosen. The separator that works is **chain status** (brand tag, curated list, branch count). "Café, not coffee shop" is best expressed as "independent, not a chain", with specialty as a badge on top.

### 2.2 Shared definitions (used by all three options)

**Chain** (any one is enough):
1. OSM `brand` or `brand:wikidata` present (710 / 674 features carry one), or Overture `brand.names.primary` present (910 rows).
2. Name (after `norm()`) in a curated `data/chains.psv` (`name|kind|note`): the current exclusion list (Starbucks, CBTL, Bo's, Tim Hortons, Pickup, ZUS, But First Coffee, Dear Joe) plus Seattle's Best, Figaro, UCC, Dunkin', Krispy Kreme, J.CO, Mister Donut, Coffee Project, Café Amazon, Luk Yuen, Chatime, Macao Imperial, Gong cha, Tiger Sugar, Serenitea, Infinitea, CoCo, St. Marc Café, KopiRoti, Greyhound Café, Country Style, Conti's, Mary Grace, Kuya J, Jollibee-group brands, Paper Moon, Cara Mia, Kenny Rogers. Treat this list as data, with a row per brand, so additions are a one-line edit.
3. **≥ 10** distinct locations in NCR under the same normalised name across OSM + Overture (deduplicated within 150 m) → `chain`; **4–9** → `chain-adjacent` (a local multi-branch brand: it stays in the directory but is labelled). The ≥4 OSM rule found 33 features; the combined count catches the names the list missed. Specialty-verified shops with 4–9 branches (Yardstick, Single Origin, Toby's Estate, %Arabica) are shown as `specialty · multi-branch`, never hidden.

**Not a café** (exclude before counting): `cuisine` ∈ {bubble_tea, donut, ice_cream, tea, cake, pastry} without `coffee_shop`; `amenity=fast_food` without `cuisine=coffee_shop` (187 features, mostly donut/fast food); `shop=bakery`; name matches `/\b(milk ?tea|boba|pisonet|computer|internet|gaming)\b/i`; `amenity=restaurant` or name matches `/\b(restaurant|grill|bistro|eatery|carinderia|diner|pub|bar|kitchen)\b/i` unless `cuisine=coffee_shop` or corroborated as a café by Overture `cafe`/`coffee_shop`; hotel lobby cafés (name contains `lounge|lobby|hotel`, or the OSM node sits inside a `tourism=hotel` way) are kept but tagged `hotel`. Unnamed features (57) are dropped.

**Dedupe**: same normalised name within 150 m = one branch; prefer the OSM node for coordinates (ODbL already governs the dataset), carry the Overture id as `overture_id` for corroboration. Our `cafes.csv` rows match the directory by normalised name within 150 m, else by name alone when the row has no coordinates (8 included branches).

**Open evidence**, strongest first, stored per row as `open_evidence` + `evidence_date`:
1. `editorial_2025_26`: the current status rule (own site/menu, press, event roster, ordering page).
2. `osm_check_2024+`: OSM `check_date` or `survey:date` ≥ 2024-01-01.
3. `overture_2026_09`: a matching Overture row in the 2026-09 release (a live Meta page; weak because pages outlive shops).
4. `osm_only`: in OSM with no date (unknown).
The card prints the evidence kind and date ("seen in OSM 2025-03"; "Facebook page live Sep 2026"; "no recent check").

**Specialty becomes a badge/tier, not an entry rule.** `class` ∈ {`specialty` (passes today's specialty rule; keeps acclaimed/recognised/indie tiers), `independent` (no chain signal, specialty unverified), `chain-adjacent`, `chain` (never in the directory; counted only in aggregates)}.

### 2.3 The options

| | **Option 1: Corroborated independents** (recommended) | **Option 2: Everything independent in OSM** (loose) | **Option 3: Twice-verified independents** (strict) |
|---|---|---|---|
| Entry rule | NCR + café (not milk tea/restaurant/bakery) + not chain + **open evidence level 1, 2 or 3** | NCR + café + not chain; no freshness requirement | NCR + café + not chain + **two** independent signals among {editorial 2025–26, OSM check ≥2025, Overture match at confidence ≥0.6, own website/IG} |
| Expected size | OSM-corroborated 374 + current branches not in OSM (~85 of 174; 87 included branches got coordinates from OSM, so most overlap) ≈ 455, minus noise (−10 to −15 %) → **≈ 390–415 branches, ≈ 320–350 shops** | 1,009 OSM independents + ~85 non-OSM editorial − noise → **≈ 950–1,000 branches** | 124 (check ≥2025) ∪ 282 (Overture) ∩ second signal: unknown overlap; estimate 180–240 OSM rows + non-OSM editorial 85 → **≈ 260–320 branches** |
| Specialty rows | 174 (all pass level 1) | 174 | 174 |
| Open evidence | every row has level ≤3; expect 10–15 % of level-3 rows to be closed in reality (Meta pages linger) | ~630 rows have no evidence at all; must be labelled "status unverified" | every row has two signals; closure rate low |
| Chains | definitions above | same | same |
| Known noise | restaurants tagged cafe, hotel lobbies, carts; filtered by the rules above; a hand `data/osm_exclusions.psv` (osm_id\|reason) for the rest | the same plus years-old OSM nodes (Manila cafés edited 2015–2019); milk tea already excluded | minimal |
| Pipeline | new `scripts/build_directory.py` (below) | same script, flag flipped | same script, stricter predicate |
| Site | directory ≈ 400 rows: filters specialty / independent / chain-adjacent, default = specialty + independent; map clustering below zoom 13; evidence line on cards | directory too long to browse; use the OSM-only rows as a **grey background layer** on the map, not as directory entries | little visible change from today (+ ~100 rows) |
| Risks | zombie rows; "independent" read as "verified independent"; ODbL covers the whole directory | honesty: a third of rows may be closed; the dataset stops meaning "open now" | effort for little gain; still skews to areas with active OSM mappers |

**Why Option 1.** It triples the directory to a size that reads as "the scene" rather than "the press list", keeps a dated evidence line on every row so the honesty stance survives, and uses the two sources we already have on disk. Option 2 is useful as a *map layer* ("all 1,000 independent cafés OSM knows about, status unverified"), which costs nothing extra once the script exists, and I recommend adding that layer under Option 1 rather than choosing Option 2. Option 3 is the fallback if the first QA pass of Option 1 finds the Overture-only corroboration to be rotten (spot-check 30 random level-3 rows against Instagram; if more than ~20 % are closed, tighten to Option 3 or drop level 3).

Rejected: an Overture-led directory (3,525 non-chain cafés at confidence ≥0.6). 96.7 % of rows are Meta pages, which include home-based sellers and long-closed shops, `operating_status` is null for all, and the only freshness field is the release date. Overture stays a corroboration and brand source, never a sole source.

### 2.4 Pipeline changes (cafe-data)

1. **New `scripts/build_directory.py`** (keeps `build_dataset.py` untouched as the specialty layer). Inputs: `sources/osm_ncr_cafes.json` (re-pull once with Overpass `out meta` so each element carries `timestamp`; today's dump has tags and coordinates only), `sources/overture_ncr_cafes_2026-09-23.1.json` (already pulled by `scripts/fetch_overture_cafes.py`), `data/chains.psv` (new), `data/osm_exclusions.psv` (new, hand list), `data/ncr_adm3.geojson`, `cafes.csv`. Output: `directory.csv` (one row per branch: `directory_id, osm_id, overture_id, name, lat, lon, city, class, open_evidence, evidence_date, cuisine, tags_summary, website, instagram, shop_slug_if_specialty, notes`) and `directory.geojson`, plus a `qa_directory.md` with the counts per class, per evidence level, per city, and the noise removed per rule.
2. **Matching**: reuse `norm()`, `canonical()`, `ALIASES`, `ncr_unit()` from `build_dataset.py` by importing them (move them to `scripts/common.py`; one-line change in each script).
3. **Chain detection** as in 2.2; log every name that trips the ≥10 / 4–9 rule so the list can be reviewed.
4. **Barangay/hex join** (shared with Part 1 idea C): add `h3` (res 8) and, if the HDX layer is downloaded, `barangay_pcode` columns via point-in-polygon; `pip install h3` only.
5. **Refresh cadence**: Overpass re-pull and Overture re-pull (new release every month; the DuckDB script already takes the release id) each quarter; rows that vanish from both sources flip to `evidence = lost`, and are hidden, not deleted, so the timeline can count them.
6. **Licensing**: the directory is OSM-derived → publish the download under ODbL with "© OpenStreetMap contributors"; Overture Places are CDLA-Permissive-2.0 (UNVERIFIED today; checked in the earlier session's `extra_sources.md`), compatible with attribution.

### 2.5 Site changes (tala-portfolio)

- `build-timpla-data.ts`: read `directory.csv`; emit `directory.json` (≈ 400 rows × 12 fields ≈ 45 KB gz-able; the 1,000-row background layer as `osm_layer.json` ≈ 40 KB with only `name, lon, lat, date`), add `cls` and `evidence` to `points.json`, and counts per class to `meta.json`.
- `/timpla/cafes/`: `BranchList.tsx` gains a class filter (`specialty` / `independent` / `chain-adjacent`) next to the tier filter; tier chips only apply inside `specialty`; default view = specialty + independent sorted by city then name; the search index covers all rows.
- `/timpla/map/`: `CafeMap.tsx` currently has no clustering; add `cluster: true, clusterRadius: 40, clusterMaxZoom: 13` on the GeoJSON source with a count label layer, keep `setFilter` for class/tier, draw independents as grey rings and specialty tiers as today, and the optional OSM background layer as 3 px dots at low opacity with its own legend entry and the "status unverified" label.
- Receipt cards: an `EVIDENCE` row ("open: Instagram post 2026-03" / "seen in OSM 2025-03" / "Facebook page live 2026-09"), and a "Report a closure" link to the GitHub issue template.
- `/timpla/data/`: new class definitions, the chain rule with its thresholds and list, the evidence levels with counts, and the sentence "independent means we found no chain signal, not that we verified ownership".
- Performance: 400 rows change nothing; the 1,000-point layer stays under the 60 KB/page data budget from PLAN §6.

### 2.6 Risks

- **Stale rows** are the main cost of growing the list: Overture corroboration is a live Facebook page, not a live café. Mitigation: evidence line on every card, quarterly re-pull, the spot-check gate in 2.3, and a one-click closure report.
- **Meaning drift**: today "in Timpla" means "specialty and open"; afterwards it means "independent café we could corroborate". The hero copy, the `/data/` page and the OG text must change together.
- **Chain thresholds misfire**: a 4-branch local roaster labelled chain-adjacent may object; keep the label neutral ("multi-branch") and show the count.
- **OSM coverage bias**: 1,039 independents are where mappers live (Makati, QC, Pasig); northern NCR stays thin, and the deserts in Part 1 idea C partly reflect that. Say so on the chart.
- **ODbL share-alike** now covers the whole directory, not just coordinates; downloads must carry it.

### 2.7 Decisions only Ivanka can make

1. **What Timpla is**: a specialty atlas with an "all independents" context layer (today's identity, Option 3-ish), or a directory of independent cafés where specialty is a badge (Option 1)? This changes the hero number (109 shops vs ~330 shops) and the site's one-sentence story.
2. **The chain line**: accept `≥10 locations = chain`, `4–9 = chain-adjacent/multi-branch`, and approve `data/chains.psv` (she knows which local brands readers consider chains; the list is editorial, not measurable).
3. **How much staleness is acceptable**: keep Overture-only corroboration (≈ 400 rows, an estimated 10–15 % closed) or require an OSM check or editorial evidence (≈ 260–320 rows). Related: whether she will do the 30-row Instagram spot-check that decides this.

---

## Suggested order of work

1. Decisions 1–3 above (an hour of her time).
2. Part 2 Option 1: `build_directory.py`, chain list, QA pass, site filters and clustering (≈ 10–14 h).
3. Earth Engine registration (30 min), then idea A and idea E+G (≈ 12–15 h), written up on `/timpla/data/` with the attribution and caveat blocks.
4. Idea C once the hex/barangay join from step 2 exists; B, H, J afterwards as story material.

Sources checked 2026-10-22: earthengine.google.com/noncommercial, earthengine.google.com/terms, developers.google.com/earth-engine/guides/noncommercial_tiers, developers.google.com/earth-engine/guides/usage, developers.google.com/earth-engine/reference/Additional.API.Terms, the Earth Engine catalog pages for every dataset ID in §1.2, sites.research.google/gr/open-buildings (country list) and its temporal page; HDX `cod-ab-phl` returned 403 to automated fetching and is UNVERIFIED beyond its search summary.
