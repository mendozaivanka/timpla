# tanim-data

The data behind Timpla's coffee chapters (Beans and Shipped in, `tala-portfolio/src/pages/timpla/`; formerly the separate Tanim site): the Philippines' coffee, province by province, from the
Philippine Statistics Authority's OpenSTAT API, plus province outlines and a hand-kept list of reported facts.

```
scripts/fetch_psa.py   pulls every series (about 60 keyless API calls, paced); writes raw/*.json and data/manifest.json
raw/                   the pulls, committed so the site builds without the API (FORCE=1 refetches a cached file)
data/manifest.json     table ids resolved by title, PSA "updated" stamps, retrieval date, build checks
data/reported.csv      kind-2 facts: province | text | source | date | url (one line each, pipe-separated)
```

Refresh after a PSA release (crops: quarterly, the annual figure settles around August; imports: mid-year):

```sh
cd tanim-data && FORCE=1 ../tala-portfolio/ask-rag/.venv/bin/python scripts/fetch_psa.py   # any Python 3.11+ with certifi
cd ../tala-portfolio && npm run tanim:data && npm run build
```

What the fetch does to stay robust: tables are found by title (not id), dimension codes by label, calls are split to
stay under about 1,000 cells and 30 calls per 10 s, CSVs are read with the BOM and Latin-1 fallback, footnote twins
("Sulu" and "Sulu c/") and city rows ("City of Davao") are merged by the build script, and the national row is checked
against the sum of regions. The import tables need the two-step positional recipe (labels via json-stat, then the
rows), because PSA omits that dimension's value list.

Series: production, area and bearing trees by province and variety (2010 on); farmgate prices; the Supply Utilization
Account, self-sufficiency and import-dependency ratios; value of production at current and 2018 prices; the coffee CPI
by province (2018 = 100); the 2023 FIES share of family spending on coffee; imports by origin and tariff line (2016 on).
Licence: PSA data, attribute PSA; outlines faeldon/philippines-json-maps (MIT), PSGC 2023.
