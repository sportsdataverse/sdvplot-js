---
"@sportsdataverse/sdvplot": minor
---

`sizeCells` no longer crowds a shot chart: a cell of a single attempt is not drawn (it still counts in the cells and their totals), and the busiest hexagons and squares stop at 0.88 of their cell, so neighbours never touch. The new `minAttempts` (default 2) and `fill` (default 0.88) options set both; `{ minAttempts: 1, fill: 1 }` restores the previous sizes. The size key starts at `minAttempts`, and `appendLegend`'s size note says single attempts are not drawn.
