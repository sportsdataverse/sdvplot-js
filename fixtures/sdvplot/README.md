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
