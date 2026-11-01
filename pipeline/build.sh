#!/usr/bin/env bash
# Builds one data version from the inputs in this folder:
#   pipeline/build/v<N>/timpla/*.json   cafés (from cafes/: editorial lists + OSM + Overture snapshots)
#   pipeline/build/v<N>/tanim/*.json    Beans and Shipped in (from beans/: PSA OpenSTAT pulls)
#   pipeline/build/v<N>/manifest.json   version, sources with dates and licences, file hashes, counts
# Usage: pipeline/build.sh <N>
set -euo pipefail
cd "$(dirname "$0")"
V="${1:?usage: pipeline/build.sh <version number>}"
OUT="build/v$V"
rm -rf "$OUT" && mkdir -p "$OUT"

echo "▸ cafés: specialty layer, then the wider directory"
(cd cafes && uv run --project .. python scripts/build_dataset.py && uv run --project .. python scripts/build_directory.py)

echo "▸ read models"
CAFE_DATA=cafes OUT_DIR="$OUT/timpla" node node/build-timpla-data.ts
TANIM_DATA=beans OUT_DIR="$OUT/tanim" node node/build-tanim-data.ts

echo "▸ manifest"
uv run python manifest.py "$OUT" "v$V"
echo "✓ built $OUT"
