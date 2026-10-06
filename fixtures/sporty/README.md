# sporty oracle fixtures

R truth captured from sportyR's built ggplot layers (every `GeomPolygon` layer in draw order, plus `coord_fixed` limits per display range).

- sportyR: 2.2.3 (git 29487c1, `/mnt/sdv_repos/sportyR`)
- R: 4.6.1 (2026-06-24)
- Generated: 2026-10-05
- Command: `Rscript tools/oracle/sporty.R basketball` (repo root; `pnpm oracle:sporty` plus a sport argument)

Never hand-edit; a mismatch is a TS bug. Consumed by `packages/sporty/test/parity.test.ts`.

## basketball

Polygon layers per league (each also has 7 `bbox_*.csv`): fiba 64, nba 106, nba_g_league 106, ncaa 90, nfhs 84, wnba 106.
