---
title: Shot charts
---

# Shot charts

The `@sportsdataverse/sdvplot/shots` kit, as blazing-the-nets' Brooklyn dashboard draws it: shots binned into hexagons or squares and compared with the league in each cell, the court's zones, the shooting signature, and attempts by distance and by side, all on one shared cursor. The shots are Brooklyn's first 2000 of 2025-26 (24 games, 22 October to 18 December 2025) and the league context is all 219,159 regular-season shots of 2025-26, from the sportsdataverse-data `nba_stats_shots` release.

```js
import * as Plot from "@observablehq/plot";
import { createSelection } from "./_sdv/sdvplot.js";
import { linkCursor, linkSelection } from "./_sdv/interact.js";
import { shootingSignature, shotCells, shotZones, surface } from "./_sdv/sdvplot-plot.js";
import {
  cellsVsDistance,
  cellsVsLeague,
  diffScale,
  fgPctByDistance,
  shrunkDiff,
  signaturePoints,
  sizeCells,
  statsBySide,
  statsByZone,
  vsLeague,
} from "./_sdv/shots.js";
import { BASKETBALL_ZONE_LABELS, basketballZones } from "./_sdv/sporty.js";
import { select } from "./components/controls.js";
```

```js
// x_legacy / y_legacy: tenths of a foot from the hoop; shot_distance in feet; shot_value 2 or 3
const allShots = await FileAttachment("data/bkn_shots_2026.json").json();
const games = await FileAttachment("data/bkn_games_2026.json").json();
// the league on hexagons of radius 10 (1 ft) and 15 (1.5 ft), by foot, by 3 ft and by side
const league = await FileAttachment("data/nba_league_2026.json").json();
// the same league shots on squares of a radius-10 hexagon's area
const leagueSquare = await FileAttachment("data/nba_league_square_2026.json").json();
```

## Which shots

**Games** keeps the shots of some of Brooklyn's 24 games, and **Shots** keeps twos or threes. Every chart on the page redraws from what is left; the league context stays the whole league.

```js
const GAME_SETS = {
  "All 24 games": () => true,
  "The 6 wins": (g) => g.wl === "W",
  "The 18 losses": (g) => g.wl === "L",
  "Home games": (g) => g.matchup.includes(" vs. "),
  "Away games": (g) => g.matchup.includes(" @ "),
};
const gameSet = view(select(Object.keys(GAME_SETS), { label: "Games", value: "All 24 games" }));
const shotValue = view(select(["All shots", "Twos", "Threes"], { label: "Shots", value: "All shots" }));
```

```js
const kept = new Set(games.filter(GAME_SETS[gameSet]).map((g) => g.game_id));
const shots = allShots.filter(
  (s) => kept.has(s.game_id) && (shotValue === "All shots" || s.shot_value === (shotValue === "Twos" ? 2 : 3)),
);
const made = shots.filter((s) => s.shot_result === "Made").length;
// one store for the whole page: it holds the shot distance under the pointer (and the court cell under it)
const store = createSelection();
const D = "shot_distance";
const pct = (v) => (v === null || v === undefined ? "n/a" : `${(v * 100).toFixed(1)}%`);
const pts = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}`;
// diffScale's domain is a fraction (0.15 is 15 points): label the legend's ticks in points
const legendPts = (d) => (d === 0 ? "0" : pts(d));
```

${shots.length} shots from ${kept.size} games: ${made} made (${pct(shots.length ? made / shots.length : null)}), ${shots.filter((s) => s.shot_value === 3).length} of them threes.

## The court

Each cell is sized by how many shots Brooklyn took there and coloured by its FG% minus the league's, shrunk toward the league by 25 attempts so a 1-for-1 cell does not shout. **Cells** picks the shape: hexagons of 1.5 ft (blazing-the-nets `main`) or 1 ft, squares of a 1 ft hexagon's area, or the court's zones. **Compare with** picks the league figure: the league in the same cell (`cellsVsLeague`), or the league at the same distance in its own palette, unshrunk (`cellsVsDistance`, blazing-the-nets `master`; hexagons only). Hover a cell for its four lines: zone, makes and attempts, the league's FG% and the difference, and the mean distance. The ring around the hoop follows the distance the charts below are pointing at.

```js
const cellShape = view(
  select(["Hexagons, 1.5 ft", "Hexagons, 1 ft", "Squares, 1 ft hexagon's area", "Zones"], {
    label: "Cells",
    value: "Hexagons, 1.5 ft",
  }),
);
const compare = view(
  select(["the league in the same cell", "the league at the same distance"], {
    label: "Compare with",
    value: "the league in the same cell",
  }),
);
```

```js
const court = surface("nba", { displayRange: "defense", rotation: 90 });
const frame = "nba-legacy-vertical"; // the shots' tenths, hoop at the bottom of a vertical half court
const hex = cellShape.startsWith("Hexagons");
const byDistance = hex && compare === "the league at the same distance";
const index = cellShape === "Hexagons, 1 ft" ? league.hex10 : cellShape.startsWith("Squares") ? leagueSquare : league.hex15;
const scale = byDistance ? diffScale({ palette: "master" }) : diffScale();
const title = (h) =>
  [
    BASKETBALL_ZONE_LABELS[h.zone],
    `${h.makes}/${h.attempts} FG, ${pct(h.fgPct)}`,
    `League ${pct(h.leagueFgPct)}${h.fgPct !== null && h.leagueFgPct !== null ? ` (${pts(h.fgPct - h.leagueFgPct)})` : ""}`,
    `${h.meanDistance.toFixed(1)} ft`,
  ].join("\n");
let courtMarks;
if (cellShape === "Zones") {
  const player = statsByZone(shots);
  courtMarks = shotZones(basketballZones("nba", { scale: 10, top: 350 }), {
    fill: (z) => {
      const rate = league.hex15.zones[z].fgPct;
      return scale(rate === null ? null : shrunkDiff(player[z].makes, player[z].attempts, rate));
    },
    text: (z) => `${player[z].makes}/${player[z].attempts}`,
    frame,
    stats: player,
    tip: true,
  });
} else {
  const cells = byDistance ? cellsVsDistance(shots, league.byFoot, index.radius) : cellsVsLeague(shots, index);
  const sizes = byDistance ? sizeCells(cells, { radius: index.radius, rule: "linear-cap" }) : sizeCells(cells, index);
  courtMarks = [
    shotCells(cells, {
      r: sizes.r,
      shape: hex ? "hex" : "square",
      frame,
      scale,
      prior: byDistance ? 0 : undefined,
      tip: { maxRadius: 18 },
      title,
    }),
  ];
}
const courtChart = Plot.plot({ ...court.scales, width: Math.min(width, 560), marks: [...court.marks, ...courtMarks] });
// the ring at the shared distance, around the vertical frame's hoop at (0, -41.75)
const offRing = linkCursor(courtChart, store, {
  field: D,
  shape: { axis: "ring", x: courtChart.scale("x"), y: courtChart.scale("y"), center: [0, -41.75] },
});
// the cell under Plot's tip lights, the rest dim
const offHover =
  cellShape === "Zones" ? () => {} : linkSelection(store, { figure: courtChart, hover: { id: (h) => `${h.x},${h.y}` } });
invalidation.then(() => {
  offRing();
  offHover();
});
display(courtChart);
display(Plot.legend({ color: { ...scale.plot, label: "FG% vs league (points)", tickFormat: legendPts } }));
```

${cellShape.startsWith("Squares") && compare === "the league at the same distance" ? "Squares compare with the league in the same cell: cellsVsDistance bins on hexagons." : ""}

## The shooting signature

FG% by distance, drawn as wide as the share of shots taken from there and coloured by FG% minus the league's at that distance (the dashed line). Hover it for one distance; the court's ring and the charts below follow.

```js
const byFoot = fgPctByDistance(shots, 1, 35);
const points = signaturePoints(vsLeague(byFoot, league.byFoot));
const signature = Plot.plot({
  width: Math.min(width, 640),
  height: 240,
  x: { label: "Shot distance (ft) →" },
  y: { domain: [0, 1], label: "↑ FG%", tickFormat: "%" },
  marks: shootingSignature(points, { curve: "basis" }),
});
const offSignature = linkCursor(signature, store, {
  field: D,
  shape: { axis: "x", scale: signature.scale("x") },
  snap: (feet) => Math.floor(feet) + 0.5,
});
invalidation.then(offSignature);
display(signature);
display(Plot.legend({ color: { ...diffScale().plot, label: "FG% vs league (points)", tickFormat: legendPts } }));
```

## By distance and by side

The share of attempts from each foot (with a readout), FG% in 3 ft bins, and attempts left, centre and right of the hoop by distance. They share one cursor: point at any of them and every chart on the page marks that distance.

A caveat in the data: ${shots.filter((s) => s.shot_value === 3 && s.shot_distance < 22).length} of these ${shots.filter((s) => s.shot_value === 3).length} threes, all of them corner threes, carry a `shot_distance` of 0 in the release, so they count at 0 ft in the charts below and in a cell's mean distance (their positions, and so the court above, are right).

```js
const within = byFoot.reduce((n, b) => n + b.attempts, 0);
const snap = (feet) => Math.floor(feet) + 0.5; // one value per 1 ft bin
const share = Plot.plot({
  width: Math.min(width, 640),
  height: 200,
  x: { label: "Shot distance (ft) →" },
  y: { label: "↑ Share of attempts (%)", percent: true },
  marks: [Plot.rectY(byFoot, { x1: "distance", x2: (b) => b.distance + 1, y: "share", inset: 0.5 })],
});
const offShare = linkCursor(share, store, {
  field: D,
  shape: { axis: "x", scale: share.scale("x"), width: 1 },
  snap,
  label: (feet) => {
    const b = byFoot[Math.floor(feet)];
    return b === undefined ? [] : [`${((100 * b.attempts) / within).toFixed(1)}%`, `${b.attempts} of ${within}`, `${b.distance} ft`];
  },
});
const by3 = fgPctByDistance(shots, 3, 35);
const fg = Plot.plot({
  width: Math.min(width, 640),
  height: 200,
  x: { label: "Shot distance (ft, 3 ft bins) →" },
  y: { label: "↑ FG%", percent: true, domain: [0, 100] },
  marks: [Plot.barY(by3, { x: "distance", y: "fgPct" })],
});
const offFg = linkCursor(fg, store, { field: D, shape: { axis: "x", scale: fg.scale("x") } });
invalidation.then(() => {
  offShare();
  offFg();
});
display(share);
display(fg);
```

```js
// a fixed centre column (x == 0) on its own narrower scale, left growing leftward and right rightward from its edges
const sides = statsBySide(shots, 1, 35, 0);
const top = Math.max(1, ...sides.flatMap((b) => [b.left.attempts, b.centre.attempts, b.right.attempts]));
const G = (top * 28) / 187; // half the column, in attempts
const mid = (b) => (G * b.centre.attempts) / top;
const band = { y1: "distance", y2: (b) => b.distance + 1, insetTop: 0.5, insetBottom: 0.5 };
const step = top > 200 ? 100 : top > 80 ? 50 : 20;
const side = Plot.plot({
  width: Math.min(width, 360),
  height: 440,
  x: {
    label: "← left   attempts   right →",
    ticks: Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => [-G - step * i, G + step * i]).flat(),
    tickFormat: (v) => String(Math.round(Math.abs(v) - G)),
  },
  y: { label: "↑ Shot distance (ft)" },
  marks: [
    Plot.ruleX([-G, G], { strokeOpacity: 0.3 }),
    Plot.rect(sides, { ...band, x1: (b) => -G - b.left.attempts, x2: -G }),
    Plot.rect(sides, { ...band, x1: (b) => -mid(b), x2: mid, fillOpacity: 0.5 }),
    Plot.rect(sides, { ...band, x1: G, x2: (b) => G + b.right.attempts }),
  ],
});
invalidation.then(linkCursor(side, store, { field: D, shape: { axis: "y", scale: side.scale("y"), width: 1 }, snap }));
display(side);
```

```js
// start the cursor just behind the arc, where Brooklyn shoots most
store.set({ cursor: { field: D, value: 26.5 } });
```
