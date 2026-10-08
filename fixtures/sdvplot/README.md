# sdvplot oracle fixtures

Python `sdvplot` answers for real inputs sampled from its own index; the TS port must match them exactly
(`packages/sdvplot/test/parity.test.ts`). Never hand-edit; a parity failure is a port bug.

- sdvplot commit: 05443a9 (`/mnt/sdv_repos/sdvplot`), version 0.1.0
- INDEX_VERSION: 1c025b69f8cf
- manifest rows: 44462
- inputs: 8403 (resolve / team_colors / logo_url cases each; 177 expected `InputError` rows) + 7 headshot_url cases
- palette: `palette_whole.json` = `palette(league)` for all 28 leagues; `palette_keyed.json` = `palette(league, [value], season=, id_system=)`
  for the first 25 `inputs` rows of each league (700 cases, 5 expected errors); keys are the caller values as strings
- run date: 2026-10-06
- command: `SDVPLOT_PY_REPO=/mnt/sdv_repos/sdvplot pnpm oracle:sdvplot`

## manifest_sample.csv

- source: the CDN `marks.csv` as cached 2026-10-05 (`/root/.cache/sdvplot/manifest/marks.csv`, 44,462 rows, the file the committed shards were built from; CRLF line endings kept)
- selection: header + every `level == team` row whose `source:entity_id` is a `mark` alias of nfl team 13 (LV) or 14 (LA Rams), or of nhl team 37 (VGK), across every source; 66 rows, byte-exact (quoted fields preserved)
- regenerate: select those rows from the cached manifest (python `csv` to classify, copy the original lines), then re-run `pnpm --filter sdvplot test manifest`

## logos/

Real archived mark images, named `<sha256>.<ext>` exactly as the CDN serves them, for render tests that cannot fetch
(`packages/sdvplot/test/chartjs/node.test.ts`).

- `aab854c59098d4f465c1c6f31b580f2a38d2ed4f5c0c03df2da76f62f5378dc4.png`: MLB team 19 (LAD) `logo` / `default`, source
  `espn`, 500 x 500, 8,909 bytes (manifest row in `packages/sdvplot/src/data/marks/mlb.ts`, first seen 2026-09-26);
  archive URL `https://sdv.nyc3.cdn.digitaloceanspaces.com/assets/public/sha256/aa/aab854c59098d4f465c1c6f31b580f2a38d2ed4f5c0c03df2da76f62f5378dc4.png`
- copied 2026-10-08 from the Python `sdvplot` image cache (fetched 2026-10-05); `sha256sum` matches the file name
