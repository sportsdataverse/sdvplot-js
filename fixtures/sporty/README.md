# sporty oracle fixtures

R truth captured from sportyR's built ggplot layers (every `GeomPolygon` layer in draw order, plus `coord_fixed` limits per display range).

- sportyR: 2.2.3 (git 29487c1, `/mnt/sdv_repos/sportyR`)
- R: 4.6.1 (2026-06-24)
- Generated: 2026-10-05
- Command: `Rscript tools/oracle/sporty.R basketball hockey` (repo root; `pnpm oracle:sporty` plus sport arguments)

Never hand-edit; a mismatch is a TS bug. Consumed by `packages/sporty/test/parity.test.ts`.

## basketball

Polygon layers per league (each also has 7 `bbox_*.csv`): fiba 64, nba 106, nba_g_league 106, ncaa 90, nfhs 84, wnba 106.

## hockey

Polygon layers per league (each also has 8 `bbox_*.csv`): ahl 63, echl 63, iihf 63, ncaa 63, nhl 63, nwhl 63, ohl 63, phf 63, pwhl 61 (no goaltender trapezoid), qmjhl 63, ushl 63.
