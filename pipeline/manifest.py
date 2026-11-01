"""Writes manifest.json for a built data version: what went in (sources, dates, licences) and what came out (hashes).

Usage: uv run python manifest.py build/v1 v1
"""
import hashlib, json, os, subprocess, sys
from datetime import date
from pathlib import Path

out, version = Path(sys.argv[1]), sys.argv[2]
here = Path(__file__).parent

def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

try:
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, cwd=here).stdout.strip() or "uncommitted"
except OSError:
    commit = "unknown"

psa = json.loads((here / "beans/data/manifest.json").read_text())
cafes_sources = sorted(p.name for p in (here / "cafes/sources").glob("*.json"))
meta = json.loads((out / "timpla/meta.json").read_text())

manifest = {
    "version": version,
    "builtAt": date.today().isoformat(),
    "pipelineCommit": commit,
    "sources": [
        {"id": "editorial", "what": "hand-curated café lists, timeline, roaster links, origins, awards",
         "files": sorted(p.name for p in (here / "cafes/data").glob("*.psv")), "licence": "CC-BY-4.0",
         "attribution": "Timpla; each row cites its own source"},
        {"id": "osm", "what": "OpenStreetMap cafés in Metro Manila", "files": [f for f in cafes_sources if f.startswith("osm_")],
         "licence": "ODbL-1.0", "attribution": "© OpenStreetMap contributors"},
        {"id": "overture", "what": "Overture Maps Places (open-evidence check)", "files": [f for f in cafes_sources if f.startswith("overture_")],
         "licence": "CDLA-Permissive-2.0 / Apache-2.0 per provider", "attribution": "Overture Maps Foundation"},
        {"id": "psa-openstat", "what": "PSA coffee production, area, trees, farmgate prices, imports", "retrievedAt": psa.get("retrievedAt"),
         "tables": psa.get("tables"), "licence": "PSA open data", "attribution": "Philippine Statistics Authority"},
        {"id": "boundaries", "what": "NCR units (geoBoundaries ADM3) and province outlines (faeldon/philippines-json-maps)",
         "licence": "CC-BY-4.0 / MIT", "attribution": "geoBoundaries; faeldon"},
    ],
    "files": {str(p.relative_to(out)): {"bytes": p.stat().st_size, "sha256": sha(p)}
              for p in sorted(out.rglob("*.json")) if p.name != "manifest.json"},
    "counts": {k: meta[k] for k in ("shops", "branches", "mapped") if k in meta},
}
(out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
total = sum(f["bytes"] for f in manifest["files"].values())
print(f"manifest: {len(manifest['files'])} files, {total / 1024:.0f} KB, counts {manifest['counts']}")
if total > 5 * 1024 * 1024:
    sys.exit(f"size guard: read models are {total / 1048576:.1f} MB (limit 5 MB). Record why in docs/DECISIONS.md and raise it.")
