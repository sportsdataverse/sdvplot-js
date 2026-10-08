---
title: Linked interactivity
---

# Linked interactivity

`@sportsdataverse/sdvplot/interact` links views through one selection store: what is hovered, what is selected, a brushed region, and a shared cursor value. A chart or a table that is linked to the store both writes to it and follows it, so linking a new view is one call. This page links a brushable Plot scatter to a hydrated sdvtables table, two charts to one cursor, two charts through the nearest mark, and a strip of games used as checkboxes.

```js
import * as Plot from "@observablehq/plot";
import { createSelection, loadLeague, toId } from "./_sdv/sdvplot.js";
import { brushFilter, linkCursor, linkSelection, nearestHover, tooltip } from "./_sdv/interact.js";
import { linkIds, logos, shotCells, surface } from "./_sdv/sdvplot-plot.js";
import { cellsVsLeague, fgPctByDistance, sizeCells } from "./_sdv/shots.js";
import { toSurfaceFrame } from "./_sdv/sporty.js";
import { createTable, defineTable } from "./_sdv/sdvtables.js";
import { hydrate, prepare, renderHTML } from "./_sdv/sdvtables-html.js";
import { scroller, select } from "./components/controls.js";
```

## A brushed scatter and a table on one store

Every NFL team's 2024 EPA per play, offence against defence, drawn as logos. Drag a rectangle on the chart to **brush** it: the teams inside become the store's selection, the rest dim, and the table keeps only the brushed teams, selected. Hover a logo to underline its table row; hover a row to light its logo; click rows to select them. **Empty brush** decides what a brush that holds no team means: `dim` keeps the empty region (everything dims, the table shows no row), `clear` drops it. The buttons move the brush from code with the handle's `move()`, in data coordinates.

```js
// nflverse play_by_play_2024, rush or pass plays with an EPA
const epa = (await FileAttachment("data/nfl_epa_2024.json").json()).map((t) => ({
  team: t.team,
  offense: t.off_epa / t.off_plays,
  defense: t.def_epa / t.def_plays,
  net: t.off_epa / t.off_plays - t.def_epa / t.def_plays,
}));
await loadLeague("nfl");
const store = createSelection();
```

```js
const empty = view(select(["dim", "clear"], { label: "Empty brush", value: "dim" }));
```

```js
const scatter = Plot.plot({
  width,
  height: Math.min(520, Math.max(340, width * 0.65)),
  grid: true,
  inset: 16,
  x: { label: "Offensive EPA/play →", tickFormat: "+.2f" },
  y: { label: "↑ Defensive EPA/play allowed (reversed)", reverse: true, tickFormat: "+.2f" },
  marks: [
    Plot.ruleX([0], { strokeOpacity: 0.4 }),
    Plot.ruleY([0], { strokeOpacity: 0.4 }),
    // `id: "team"`: each logo's link id is its abbreviation, the table's rowKey
    logos(epa, { league: "nfl", x: "offense", y: "defense", team: "team", id: "team", height: 0.075 }),
  ],
});
const offScatter = linkSelection(store, { figure: scatter });
const brush = brushFilter(scatter, store, { data: epa, x: "offense", y: "defense", id: "team", empty });
invalidation.then(() => {
  offScatter();
  brush.destroy();
});
// the buttons drive the brush from code: the best quadrant (gained more than 0, allowed less than 0), or none
const buttons = document.createElement("div");
for (const [label, region] of [
  ["Brush good offence and good defence", { x: [0, 0.25], y: [-0.15, 0] }],
  ["Clear the brush", null],
]) {
  const b = Object.assign(document.createElement("button"), { type: "button", textContent: label });
  b.style.marginInlineEnd = "0.5em";
  b.addEventListener("click", () => brush.move(region));
  buttons.append(b);
}
display(buttons);
display(scatter);
```

```js
const spec = defineTable()
  .columns((c) => [
    c.logo("team", { league: "nfl", includeName: true, label: "Team" }),
    c.num("offense", { label: "Offence", digits: 3, forceSign: true }),
    c.num("defense", { label: "Defence", digits: 3, forceSign: true }),
    c.num("net", { label: "Net", digits: 3, forceSign: true }),
  ])
  .title("NFL EPA per play, 2024")
  .rowKey("team")
  .build();
await prepare(spec);
const table = createTable(spec, epa, { pageSize: 8, sort: { col: "net", dir: "desc" } });
const host = document.createElement("div");
host.innerHTML = renderHTML(table);
hydrate(host.querySelector(".sdvt"), table);
invalidation.then(linkSelection(store, { table }));
display(scroller(host));
```

```js
// the store, read back on every change
const state = Generators.observe((notify) => {
  notify(store.getState());
  return store.subscribe(notify);
});
```

The store now holds: ${state.predicate ? "a brushed region" : "no brush"}; selected ${state.selected.size ? [...state.selected].join(", ") : "nothing"}; hovering ${state.hover.size ? [...state.hover].join(", ") : "nothing"}.

## One cursor across two charts

The Chiefs' and the Eagles' 2024 regular seasons, week by week: each bar is a game's margin. `linkCursor` draws the store's **cursor** (one shared value, here a week) through each chart's own scale, and writes the week under the pointer. Point at a week in either chart: both mark it, and each says who that team played. The teams had different bye weeks (Philadelphia in week 5, Kansas City in week 6), so in a bye week one chart has nothing to say.

```js
const games = await FileAttachment("data/kc_phi_games_2024.json").json();
const weekStore = createSelection();
const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);
const season = (team) =>
  games
    .filter((g) => g.home_team === team || g.away_team === team)
    .map((g) => {
      const home = g.home_team === team;
      const margin = home ? g.home_score - g.away_score : g.away_score - g.home_score;
      const opponent = home ? g.away_team : g.home_team;
      return { team, week: g.week, margin, line: `${margin > 0 ? "beat" : "lost to"} ${opponent} ${home ? g.home_score : g.away_score}-${home ? g.away_score : g.home_score}${home ? "" : " (away)"}` };
    });
```

```js
const weekChart = (team) => {
  const rows = season(team);
  const chart = Plot.plot({
    width,
    height: 190,
    marginTop: 30,
    x: { domain: WEEKS, label: "Week →", padding: 0.15 },
    y: { label: `↑ ${team} margin`, grid: true, domain: [-40, 40] },
    color: { domain: [false, true], range: ["#c0392b", "#2e7d32"] },
    marks: [
      Plot.barY(rows, { x: "week", y: "margin", fill: (d) => d.margin > 0 }),
      Plot.ruleY([0]),
    ],
  });
  const off = linkCursor(chart, weekStore, {
    field: "week",
    shape: { axis: "x", scale: chart.scale("x") },
    // on a band scale the cursor's value is the middle of the band (10.5 is week 10)
    label: (value) => {
      const week = Math.floor(value);
      const g = rows.find((r) => r.week === week);
      return [`Week ${week}`, g ? g.line : "bye"];
    },
  });
  return { chart, off };
};
const kc = weekChart("KC");
const phi = weekChart("PHI");
invalidation.then(() => {
  kc.off();
  phi.off();
});
display(kc.chart);
display(phi.chart);
weekStore.set({ cursor: { field: "week", value: 18.5 } }); // start on week 18
```

## The nearest mark, and a tooltip anywhere

Brooklyn's first 2000 shots of 2025-26 on a half court, and the share of them from each foot. Both charts are keyed by shot distance, so hovering one shot lights every shot from that distance and its bar. `nearestHover` hovers the **nearest** mark rather than the one exactly under the pointer: on the court, the closest shot within 18 px (a Delaunay search); on the bars, the foot under the pointer's x, however far below the bar's top it is. The court's box comes from `nearestHover`'s label; the bars' box is `tooltip()`, driven by the store, so it shows whichever chart wrote the hover.

```js
const bkn = await FileAttachment("data/bkn_shots_2026.json").json();
const nearStore = createSelection();
const bins = fgPctByDistance(bkn, 1, 35);
const lines = (id) => {
  const b = bins[Number(id)];
  // heaves from past 35 ft have no bar: they hover, with no box
  return b === undefined ? null : [`${b.distance} ft`, `${b.makes} of ${b.attempts} made`, `${(100 * b.share).toFixed(1)}% of shots`];
};
```

```js
const shotRows = toSurfaceFrame(bkn, { from: "nba-legacy-vertical" });
const half = surface("nba", { displayRange: "defense", rotation: 90 });
const courtChart = Plot.plot({
  ...half.scales,
  width: Math.min(width, 480),
  marks: [
    ...half.marks,
    Plot.dot(shotRows, {
      x: "surface_x",
      y: "surface_y",
      r: 2.5,
      fill: (s) => (s.shot_result === "Made" ? "#1d428a" : "none"),
      stroke: "#1d428a",
      strokeWidth: 0.7,
      render: linkIds(shotRows, (s) => s.shot_distance),
    }),
  ],
});
const sx = courtChart.scale("x");
const sy = courtChart.scale("y");
const offCourt = linkSelection(nearStore, { figure: courtChart, hover: false }); // nearestHover writes the hover
const nearCourt = nearestHover(courtChart, nearStore, {
  points: shotRows.map((s) => ({ x: sx.apply(s.surface_x), y: sy.apply(s.surface_y), id: toId(s.shot_distance) })),
  radius: 18,
  label: (id) => (lines(id) ? { lines: lines(id) } : null),
});

const bars = Plot.plot({
  width: Math.min(width, 480),
  height: 200,
  x: { label: "Shot distance (ft) →", domain: [0, 36] },
  y: { label: "↑ Share of shots", tickFormat: "%" },
  marks: [
    Plot.rectY(bins, { x1: "distance", x2: (b) => b.distance + 1, y: "share", inset: 0.5, render: linkIds(bins, "distance") }),
  ],
})
const bx = bars.scale("x");
const by = bars.scale("y");
const offBars = linkSelection(nearStore, { figure: bars, hover: false });
const nearBars = nearestHover(bars, nearStore, {
  points: bins.map((b) => ({ x: bx.apply(b.distance + 0.5), y: by.apply(b.share), id: toId(b.distance) })),
  dimension: "x",
  padding: 5,
});
// tooltip(): a box you place yourself; here at the hovered foot's bar, whichever chart hovered it
const box = tooltip(bars);
const offBox = nearStore.subscribe((s) => {
  const [id] = s.hover;
  const b = id === undefined ? undefined : bins[Number(id)];
  if (b === undefined) box.hide();
  else box.show(bx.apply(b.distance + 0.5), by.apply(b.share), lines(id));
});
invalidation.then(() => {
  for (const off of [offCourt, offBars, offBox]) off();
  for (const h of [nearCourt, nearBars, box]) h.destroy();
});
const pair = document.createElement("div");
pair.style.cssText = "display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end";
pair.append(courtChart, bars);
display(pair);
```

## Marks as checkboxes

`linkSelection(store, { figure, select: "toggle" })` turns every stamped mark into a checkbox: click a game, or Tab to it and press Enter or Space, to add it to the store's selection or take it out. Each cell is one of Brooklyn's 24 games, green for a win; the court below draws only the checked games' shots (all of them when none is checked), in 1.5 ft hexagons against the league.

```js
const bknGames = await FileAttachment("data/bkn_games_2026.json").json();
const league = await FileAttachment("data/nba_league_2026.json").json();
const gameStore = createSelection();
```

```js
const strip = Plot.plot({
  width,
  height: 64,
  marginBottom: 24,
  x: { type: "band", label: null, tickFormat: (d) => d.slice(5), ticks: bknGames.filter((_, i) => i % 4 === 0).map((g) => g.game_date) },
  color: { domain: ["W", "L"], range: ["#2e7d32", "#9e9e9e"] },
  marks: [
    Plot.cell(bknGames, {
      x: "game_date",
      fill: "wl",
      inset: 1,
      // each checkbox's accessible name
      ariaLabel: (g) => `${g.game_date} ${g.matchup} ${g.wl}`,
      title: (g) => `${g.game_date} ${g.matchup} ${g.wl}`,
      render: linkIds(bknGames, "game_id"),
    }),
  ],
});
invalidation.then(linkSelection(gameStore, { figure: strip, select: "toggle" }));
display(strip);
```

```js
const checked = Generators.observe((notify) => {
  notify(gameStore.getState().selected);
  return gameStore.subscribe((s) => notify(s.selected));
});
```

```js
const picked = checked.size === 0 ? bkn : bkn.filter((s) => checked.has(s.game_id));
const cells = cellsVsLeague(picked, league.hex15);
const court = surface("nba", { displayRange: "defense", rotation: 90 });
display(
  Plot.plot({
    ...court.scales,
    width: Math.min(width, 480),
    marks: [
      ...court.marks,
      shotCells(cells, { r: sizeCells(cells, league.hex15).r, frame: "nba-legacy-vertical" }),
    ],
  }),
);
```

${checked.size === 0 ? `No game is checked, so the court shows all ${bkn.length} shots.` : `${checked.size} game${checked.size === 1 ? "" : "s"} checked: ${picked.length} shots, ${picked.filter((s) => s.shot_result === "Made").length} made.`}
