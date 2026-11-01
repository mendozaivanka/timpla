# Pipeline runbook

## Stages

1. `pipeline/cafes/scripts/build_dataset.py`: editorial lists + rules → `cafes.csv` (specialty layer).
2. `pipeline/cafes/scripts/build_directory.py`: OSM + Overture + chains → `directory.csv`, `osm_layer.json`.
3. `pipeline/node/build-timpla-data.ts` and `build-tanim-data.ts`: read models into `pipeline/build/v<N>/`.
4. `pipeline/manifest.py`: sources, licences, file hashes, counts; fails over 5 MB.
5. `scripts/release-data.sh <N>`: tarball + SHA256SUMS + manifest as release `data-v<N>`; pins `data.lock.json`.

## Situations

| Situation | What happens | What to do |
| --- | --- | --- |
| PSA fetch fails in the monthly run | the run fails before building; an issue opens | rerun later (Actions → Data); PSA has outages |
| PSA renamed a table | `fetch_psa.py` stops on the title lookup | update the title in `fetch_psa.py`, PR |
| Nothing changed | no release, no PR | nothing |
| Site fails to build on new data | no release | fix the schema or the pipeline in a PR |
| Bad data went live | | pin the previous version: `scripts/data-pin.sh <N-1> <sha256>`, PR, merge |
| Workflow disabled after 60 quiet days | the monthly run stops | Actions → Data → Enable workflow |

## Refreshing OSM and Overture by hand

```sh
cd pipeline/cafes
curl -A "timpla-pipeline/1 (+https://github.com/mendozaivanka/timpla)" --data-urlencode 'data@sources/raw/osm_cafes_meta.ql' \
  https://overpass-api.de/api/interpreter -o sources/osm_ncr_cafes_meta_$(date +%F).json
uv run --project .. python scripts/fetch_overture_cafes.py sources/overture_ncr_cafes_<release>.json   # edit the release id in the script
```

Then update the two filenames at the top of `scripts/build_directory.py`, run `pipeline/build.sh 0`, compare, and open a PR.
