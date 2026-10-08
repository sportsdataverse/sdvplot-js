---
"@sportsdataverse/sdvplot": minor
"@sportsdataverse/sporty": minor
---

Shot-chart utilities (blazing-the-nets parity, J34/J36), with hexagon or square cells (J38):

- New `sdvplot/bins` subpath, dependency-free x/y binning for any data: `hexbin` and `hexagonPath` (a d3-hexbin port), `squarebin` and `squarePath`, `binner` (hexagons, squares, or squares of a hexagon's area from one options object), `cellPath`, `cellPoints`.
- New `sdvplot/shots` subpath (re-exports the binners): `binShots`, `leagueIndex`, `cellsVsLeague`, `cellsVsDistance`, `shrunkDiff`, `LEAGUE_PRIOR_ATTEMPTS`, `sizeCells`, `statsByZone`, `fgPctByDistance`, `vsLeague`, `statsBySide`, `signaturePoints`, `diffScale`.
- Plot marks `shotCells` (hexagons or squares via `shape`), `shotZones`, `shootingSignature`.
- d3 `appendLegend` (diff colour bar plus a hexagon or square size key) and `appendSignature`; `appendHeadshots` draws circular faces (`clip: "circle"`, `ring`, `placeholder`).
- React `<Headshot fallback="initials" name="…">`: the player's initials when there is no headshot or it fails to load, server-rendered pages included. The initials box reads the new `--sdv-line` CSS variable.
- sporty: `basketballZoneOf`, `basketballZones`, `BASKETBALL_ZONES`, `BASKETBALL_ZONE_LABELS`, and the `nba-legacy-vertical` frame in `FRAMES` (hoop at the bottom).
