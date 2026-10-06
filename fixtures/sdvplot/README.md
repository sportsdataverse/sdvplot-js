# sdvplot oracle fixtures

Python `sdvplot` answers for real inputs sampled from its own index; the TS port must match them exactly
(`packages/sdvplot/test/parity.test.ts`). Never hand-edit; a parity failure is a port bug.

- sdvplot commit: 05443a9 (`/mnt/sdv_repos/sdvplot`), version 0.1.0
- INDEX_VERSION: 1c025b69f8cf
- manifest rows: 44462
- inputs: 8403 (resolve / palette / logo_url cases each; 177 expected `InputError` rows) + 7 headshot_url cases
- run date: 2026-10-05
- command: `SDVPLOT_PY_REPO=/mnt/sdv_repos/sdvplot pnpm oracle:sdvplot`
