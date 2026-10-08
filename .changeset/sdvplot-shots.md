---
"@sportsdataverse/sdvplot": minor
---

Shot-chart utilities, ported from the Blazing the Nets shot charts, with hexagon or square cells:

- `sdvplot/bins`, dependency-free x/y binning for any data: `hexbin` and `hexagonPath` (a d3-hexbin port), `squarebin` and `squarePath`, `binner` (hexagons, squares, or squares of a hexagon's area from one options object), `cellPath`, `cellPoints`.
- `sdvplot/shots` (re-exports the binners; install `@sportsdataverse/sporty` with it): `binShots`, `leagueIndex`, `cellsVsLeague`, `cellsVsDistance`, `shrunkDiff`, `LEAGUE_PRIOR_ATTEMPTS`, `sizeCells`, `statsByZone`, `fgPctByDistance`, `vsLeague`, `statsBySide`, `signaturePoints`, `diffScale`.
- Plot marks `shotCells` (hexagons or squares via `shape`), `shotZones`, `shootingSignature`.
- `shotZones`' labels take no pointer events, so a click or hover on a label reaches its zone; with `text`, each zone's accessible name carries its label's text ("Paint (non-RA), 136/326").
- d3 `appendLegend` (diff colour bar plus a hexagon or square size key) and `appendSignature`; `appendHeadshots` draws circular faces (`clip: "circle"`, `ring`, `placeholder`).
- React `<Headshot fallback="initials" name="…">`: the player's initials when there is no headshot or it fails to load, server-rendered pages included. The initials box reads the `--sdv-line` CSS variable.
