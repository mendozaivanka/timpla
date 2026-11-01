# timpla

Timpla's site (`web/`, Astro 7 + React + MapLibre + Nordic Rose) and its data pipeline (`pipeline/`). Deployed to
GitHub Pages at https://mendozaivanka.github.io/timpla/ by `.github/workflows/deploy.yml`. README.md has the details.

- **Data reaches the site only through releases.** `pipeline/build.sh <N>` → `scripts/release-data.sh <N>` publishes
  `data-v<N>` and pins it in `data.lock.json`; `scripts/data-pull.sh` unpacks the pinned release into
  `web/src/data/{timpla,tanim}/` (git-ignored). Never hand-edit those JSON files or a published release.
- **Curated inputs** (`pipeline/cafes/data/*.psv`, `pipeline/beans/data/reported.csv`) are edited by hand and cite a source
  per row. Rules in `pipeline/cafes/README.md`: four inclusion rules, recognition is a tier not a filter, no Google or
  Foursquare ratings ever, chains excluded.
- **Definite data only** for the coffee chapters: PSA counts and reported facts with links. No modelled or estimated
  municipal figures.
- **Never commit** scraped brand store lists, menu PDFs, Shopify dumps or mall tenant lists (licence and terms).
- **Base path:** the site lives under `/timpla`. Internal links are written `/timpla/...`; files in `web/public/` must
  use `import.meta.env.BASE_URL`.
- **Design system:** files from `../nordic-rose` are vendored (`npm run design:sync`), never edited here. Timpla's own
  colours (map tiers, `--independent`, `--harvest`) are in `web/src/styles/global.css`.
- Astro's compiler misreads `x! / y` as a regex in `.astro` files: write `(x ?? 0) / y`.
- **Commits and PRs carry no AI attribution** (no Co-Authored-By Claude, no "Generated with Claude Code").
- Verify with `scripts/data-pull.sh --local` (after `pipeline/build.sh`) and `cd web && npm run build`. Commit/push only when asked.
