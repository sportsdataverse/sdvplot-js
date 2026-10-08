# @sportsdataverse/sdvplot

Team identity, colors, logos, wordmarks and headshots for SportsDataverse plots. TypeScript port of the Python `sdvplot` package (and `sdvplotR`).

## Quick start

```ts
import { resolve, palette, logoUrl } from "@sportsdataverse/sdvplot";

const id = await resolve("KC", "nfl", { season: 2023 }); // canonical TeamId
const colors = await palette("nfl", ["KC"]); // { KC: "#e31837" }
const url = await logoUrl("KC", "nfl"); // CDN logo URL
// React: import { TeamLogo } from "@sportsdataverse/sdvplot/react"; <TeamLogo team="KC" league="nfl" size={32} />
```

A shot chart with Observable Plot (needs `@observablehq/plot` and `@sportsdataverse/sporty`, both optional peers):

```js
import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos, surface, teamColor } from "@sportsdataverse/sdvplot/plot";
import { toSurfaceFrame } from "@sportsdataverse/sporty";

await loadLeague("nba");

// stats.nba.com shots (shotchartdetail LOC_X/LOC_Y as x_legacy/y_legacy, the frame's defaults): tenths of a foot
// from the hoop. Two real ones, Lakers at Nuggets on 2023-10-24 (game 0022300061, events 510 and 530).
// Every shot lands on the -x half, so draw the defensive half only: displayRange "defense".
const rawShots = [
  { x_legacy: -53, y_legacy: 285, team: "LAL", made: true },
  { x_legacy: -136, y_legacy: 214, team: "DEN", made: true },
];
const shots = toSurfaceFrame(rawShots, { from: "nba-legacy" });
const court = surface("nba", { team: "DEN", displayRange: "defense" });
Plot.plot({
  ...court.scales,
  width: 940,
  color: teamColor("nba", { values: shots.map((s) => s.team) }),
  marks: [
    ...court.marks,
    Plot.dot(shots, { x: "surface_x", y: "surface_y", fill: "team", r: 5 }),
    logos(shots, { league: "nba", x: "surface_x", y: "surface_y", team: "team", height: 0.08 }),
  ],
});
```

`resolveSync`, `teamColorsSync`, `logoUrlSync` and `selectMarkSync` are available once `loadLeague(league)` (or `preloadAll()`) has run.
`headshotUrl` is sync; gsis ids additionally need `loadGsis()` (or `preloadAll()`) first — the nflverse map is its own ~3 MB chunk, loaded only on demand. Mark rows never store `archive_url`: it is derived from `sha256` + `ext` at load time, so only the content-addressed CDN URL can ever reach a page.

## Two-team colours

`matchupColors(teamA, teamB, { league })` picks colours that tell two teams apart on one chart (Game on Paper's "game colours"). It returns one `[teamA, teamB]` pair per theme: each colour reads at WCAG 2.5:1 or better on that theme's background, and the two are at least 20 apart in CIEDE2000. The primaries are kept whenever they work; otherwise teamB's secondary is tried, then teamA's, then both, and only then is a colour's lightness moved.

```ts
import { matchupColors } from "@sportsdataverse/sdvplot";

const { light, dark } = await matchupColors("Alabama", "Georgia", { league: "cfb" });
// light: ["#9e1b32", "#2c2a29"]  (Georgia's crimson is too close to Alabama's)
// dark:  ["#ffffff", "#ba0c2f"]  (Alabama's crimson does not read on the dark background)
const [home, away] = window.matchMedia("(prefers-color-scheme: dark)").matches ? dark : light;
```

The backgrounds default to `#ffffff` (light) and `#181a1b` (dark); pass `theme: { light, dark }` for your own. `matchupColorsSync` is the same once the league is loaded. Parity: the pairs match Game on Paper's `pickGameColors` exactly on 69 real college-football matchups (`fixtures/matchup-colors`).

## Subpaths

| Import | Contents |
| --- | --- |
| `@sportsdataverse/sdvplot` | `resolve`, `suggest`, `teams`, `rowsFrom`, `palette`, `teamColors`, `matchupColors`, `logoUrl`, `marks` (`full: true` fetches the whole manifest lazily), `selectMark`, `selectMarkSync`, `place`, `placeSync`, `prepareTiers`, `headshotUrl`, `loadGsis`, contrast helpers (`hex6`, `luminance`, `contrast`, `onColor`, `mix`, `solid`), `versions`, errors, types |
| `@sportsdataverse/sdvplot/react` | `TeamLogo`, `Wordmark`, `Headshot`, `useTeamColors`, `useResolve` (React >= 18, optional peer) |
| `@sportsdataverse/sdvplot/plot` | Observable Plot marks and scales: `logos`, `wordmarks`, `headshots`, `axisLogos`, `teamColor`/`teamFill`, `meanLines`/`medianLines`, `titleImage`, `teamTiers`, `surface`, shot-chart marks `shotCells`, `shotZones`, `shootingSignature` (optional peers `@observablehq/plot`, `@sportsdataverse/sporty`) |
| `@sportsdataverse/sdvplot/d3` | `appendLogos`, `appendWordmarks`, `appendHeadshots` (circular faces: `clip`, `ring`, `placeholder`), `teamColorScale`, `appendSurface`, shot-chart `appendLegend` and `appendSignature` (optional peers `d3`, `@sportsdataverse/sporty`) |
| `@sportsdataverse/sdvplot/bins` | Dependency-free x/y binning for any data: `hexbin` and `hexagonPath` (a d3-hexbin port), `squarebin` and `squarePath`, `binner` (hexagons, squares, or equal-area squares from one options object), `cellPath`, `cellPoints` |
| `@sportsdataverse/sdvplot/shots` | Shot-chart data and colour, no Plot or d3: the `./bins` binners, `diffScale`, `binShots`, `leagueIndex`, `cellsVsLeague`, `cellsVsDistance`, `shrunkDiff`, `LEAGUE_PRIOR_ATTEMPTS`, `sizeCells`, `statsByZone`, `fgPctByDistance`, `vsLeague`, `statsBySide`, `signaturePoints` (optional peer `@sportsdataverse/sporty`, for the zones) |
| `@sportsdataverse/sdvplot/chartjs` | Chart.js 4: `logoPoints`, `wordmarkPoints`, `headshotPoints`, `pointImages`, `axisLogos`, `logoWatermarks`, `teamColor`/`teamFill` (optional peer `chart.js` >= 4.4; no sporty needed) |
| `@sportsdataverse/sdvplot/chartjs/surface` | Chart.js 4 court, field or rink background: `surface` (optional peers `chart.js` >= 4.4, `@sportsdataverse/sporty`) |
| `@sportsdataverse/sdvplot/export` | Node only: `toPNG` (SVG to PNG; optional peer `@resvg/resvg-js`), `socialCard` (fixed-ratio framing, `gt_social_crop`), `svgSize`, `parseAspect`, `parseGravity`, `checkColor`, `canvasFor`, `offsetFor`, `peerMissing` |
| `@sportsdataverse/sdvplot/testing` | Adapter-contract suite for renderer adapters: `checkAdapterContract`, `drawnMarks`, `drawnAxisMarks`, `visibleAxisLabels` |
| `@sportsdataverse/sdvplot/plotly` | `withLogos`, `withWordmarks`, `withHeadshots`, `withAxisLogos`, `teamColorway`, `embedSources` (no runtime dependency) |
| `@sportsdataverse/sdvplot/vega` | `withLogos`, `withWordmarks`, `withHeadshots`, `logoLayer`, `withAxisLogos`, `teamColorScale`, `embedSources` (no runtime dependency) |
| `@sportsdataverse/sdvplot/echarts` | `withLogos`, `withWordmarks`, `withHeadshots`, `withAxisLogos`, `teamColorPalette`, `embedSources` (no runtime dependency) |

## Spec adapters (Plotly, Vega-Lite, ECharts) — zero runtime deps

These patch a plain spec object and never import the charting library: use whatever plotly.js / vega-embed / echarts
build you already load. Each verb returns a NEW spec and leaves its input alone. The verbs are synchronous, so load the
team data first (`preloadAll()` or `loadLeague(league)`).

```ts
import * as Plotly from "plotly.js"; // any build: plotly.js-dist-min works the same
import { preloadAll } from "@sportsdataverse/sdvplot";
import { withLogos } from "@sportsdataverse/sdvplot/plotly";

await preloadAll();
// 2024 regular-season points scored and allowed: two rows of the repo's real STANDINGS sample
// (packages/sdvtables/test/fixtures/standings.ts, from nflverse games.csv)
const rows = [
  { team: "KC", pf: 385, pa: 326 },
  { team: "BUF", pf: 525, pa: 368 },
];
// TypeScript: type the figure as plotly.js's own and the same type comes back for Plotly.newPlot (JS needs no type)
const base: { data: Plotly.Data[]; layout: Partial<Plotly.Layout> } = {
  data: [{ type: "scatter", mode: "markers", x: rows.map((r) => r.pf), y: rows.map((r) => r.pa) }],
  layout: {},
};
const fig = withLogos(base, rows, { x: "pf", y: "pa", team: "team", league: "nfl", height: 0.12 });
await Plotly.newPlot(document.getElementById("chart")!, fig.data, fig.layout);
```

Vega-Lite's `TopLevelSpec` and echarts' `EChartsOption` come back as themselves the same way.

Options every adapter takes (`withLogos` / `withWordmarks` / `withHeadshots` are the mark verbs):

| Option | Verbs | Meaning |
| --- | --- | --- |
| `x`, `y` | marks | Row columns holding each image's position |
| `team` | `withLogos`, `withWordmarks` | Row column holding the team (abbreviation, name or id) |
| `player` | `withHeadshots` | Row column holding the player id |
| `league` | all | `"nfl"`, `"nba"`, `"cfb"`, ... |
| `season` | logos, wordmarks, `withAxisLogos` | A season; for the mark verbs also the name of a row column holding each row's season |
| `height` | all | Image height as a fraction of the plot area's height, in (0, 1]; default 0.1 |
| `alpha` | marks | Opacity in [0, 1]; default 1 |
| `variant` | logos, wordmarks, `withAxisLogos` | Logo variant, e.g. `"dark"` |
| `idSystem` | all | How the team values are read (default `"auto"`); for headshots `"espn"` (default) or `"gsis"` (needs `loadGsis()`) |
| `markType` | `withAxisLogos` | `"logo"` (default) or `"wordmark"` |
| `embed` | all | `await embedSources(urls)` (each subpath exports it): inlines the images as data URIs (offline HTML, static export) |

An unknown team or player is skipped with one warning per call. The colour helpers (`teamColorway`, `teamColorScale`,
`teamColorPalette`) take `(league, teams, { which, season, idSystem, fallback })`: `which` is `"primary"` (default) or
`"secondary"`, and an unknown team gets `fallback` (default `"#808080"`).

**Plotly** (`layout.images`):

| Option | Verbs | Meaning |
| --- | --- | --- |
| `xref`, `yref` | all | The subplot's axes, e.g. `"x2"`, `"y2"`; default `"x"`, `"y"` |
| `layer` | marks | `"above"` (default) or `"below"` the traces |

`height` is a fraction of the subplot. The mark verbs PIN the axis ranges (with half a mark of room), because a
data-placed image is sized in axis units; set `layout.xaxis.range` yourself to keep your own. `withAxisLogos` sizes
margins in pixels from `layout.width`/`layout.height` (Plotly's 700 × 450 when unset). x-axis images hang under their
subplot and `margin.b` grows by what reaches below the figure; under an upper subplot they hang into the one below.

**Vega-Lite** (a native `image` layer):

| Option | Verbs | Meaning |
| --- | --- | --- |
| `chartHeight` | `logoLayer` | The chart height in px that `height` is a fraction of; default 300 |
| `xType`, `yType` | `logoLayer` | The layer's encoding types (its fields are `x` and `y`); default `"quantitative"` |

The verbs size from the chart's own `height` (else `config.view.continuousHeight`, else 300 px); a discrete y axis needs
`height`. A discrete `sort` that Vega-Lite drops once a layer is added raises: sort with a list (`sort: [...]`). The
shorthand `"-y"` works where Vega-Lite keeps it; on a stacked bar or area it sums the measure, which Vega-Lite drops,
so it raises too. A `count` sort is written out as its order (a list) on both layers, so the image rows do not add to
the counts; that needs inline data with no `transform`. `withAxisLogos` assumes the default axis orient (x at the
bottom, y on the left): with `orient: "top"` or `"right"` the images land on the opposite side.

**ECharts** (a `custom` series; axis logos as rich-text labels):

| Option | Verbs | Meaning |
| --- | --- | --- |
| `xAxisIndex`, `yAxisIndex` | marks | The axes (and so the grid) the series draws on; default 0. Calls on other axes (or another `z`) get their own series |
| `z` | marks | The series' z; default 100 |
| `axisIndex` | `withAxisLogos` | Which x (or y) axis, for an option with several; default 0 |
| `chartHeight` | `withAxisLogos` | The canvas height in px (an option has none); default 400 |

Mark images are `height` × the grid's height at render time (they follow zoom and resize; no instance needed).
Axis images are `height` of the axis' grid on a `chartHeight` px canvas: `grid.height`, else `chartHeight` less
`grid.top` and `grid.bottom` (ECharts' 65 and 80 px when unset); `containLabel` can shrink the drawn grid a little
below that. The helper series have no `name`, so a default `legend: {}` lists only your series.

## Chart.js (Astro, Svelte, React, plain scripts)

`@sportsdataverse/sdvplot/chartjs` returns Chart.js 4 dataset options and plugin objects, so no framework needs a
wrapper. Load the league first, and build point styles and plugins in the browser (they create `<img>`/`<canvas>`), or
pass `loadImage` to render in Node ([below](#server-side-rendering-node)).

An Astro page with a Svelte 5 island (Game on Paper's stack):

```astro
---
// src/pages/teams.astro
import TeamScatter from "../components/TeamScatter.svelte";
// 2024 points scored and allowed, e.g. [{ team: "KC", pf: 385, pa: 326 }, { team: "BUF", pf: 525, pa: 368 }, …]
// (real rows: the repo's STANDINGS sample, packages/sdvtables/test/fixtures/standings.ts)
const rows = await getTeamRows();
---
<TeamScatter client:only="svelte" rows={rows} />
```

```svelte
<!-- src/components/TeamScatter.svelte -->
<script lang="ts">
  import Chart from "chart.js/auto";
  import { loadLeague } from "@sportsdataverse/sdvplot";
  import { logoPoints, pointImages } from "@sportsdataverse/sdvplot/chartjs";

  let { rows }: { rows: { team: string; pf: number; pa: number }[] } = $props();
  let canvas: HTMLCanvasElement;

  $effect(() => { // runs in the browser only, never during SSR
    // read `rows` here, synchronously: Svelte 5 tracks only what an effect reads before it awaits, so this re-runs on a new `rows`
    const data = rows.map((r) => ({ x: r.pf, y: r.pa }));
    const teams = rows.map((r) => r.team);
    let chart: Chart | undefined;
    let live = true;
    loadLeague("nfl").then(() => {
      if (!live) return;
      chart = new Chart(canvas, {
        type: "scatter",
        data: { datasets: [{ data, ...logoPoints(teams, { league: "nfl", radius: 14 }) }] },
        plugins: [pointImages],
      });
    });
    return () => { live = false; chart?.destroy(); };
  });
</script>

<canvas bind:this={canvas}></canvas>
```

The line charts below draw Super Bowl LIX (Kansas City at Philadelphia, 2025-02-09). `wp` is ESPN's win probability
for Philadelphia, the home team, after each of the game's 186 plays, against minutes played:
`[{ minute: 0, home_wp: 0.5846 }, …, { minute: 60, home_wp: 1 }]`. These are the repo's real `SUPER_BOWL_LIX_WP` rows
(`examples/src/data.ts`, from ESPN Site v2 `summary?event=401671889`).

A line per team with its logo at the line's end (the per-point logos of Game on Paper's trends chart, team colours from
sdvplot):

```ts
const series = {
  PHI: wp.map((p) => ({ x: p.minute, y: p.home_wp })),
  KC: wp.map((p) => ({ x: p.minute, y: 1 - p.home_wp })),
};
new Chart(canvas, {
  type: "scatter",
  data: {
    datasets: Object.entries(series).map(([team, pts]) => ({
      label: team,
      data: pts,
      showLine: true,
      borderWidth: 3,
      borderColor: teamColor(team, "nfl"),
      backgroundColor: teamColor(team, "nfl", { alpha: 0.5 }),
      pointStyle: logoPoints([team], { league: "nfl", radius: 14 }).pointStyle, // one style, repeated per point
      pointRadius: pts.map((_, i) => (i === pts.length - 1 ? 14 : 0)), // drawn only at the line's end
    })),
  },
  plugins: [pointImages],
});
```

A radar in team colours (the datasets Game on Paper's `utils/radar.ts` builds for `TeamRadarChart.svelte` and
`MatchupRadarChart.svelte`):

```ts
import { teamColor, teamFill } from "@sportsdataverse/sdvplot/chartjs";
// 2024 regular season (17 games): two rows of the repo's real STANDINGS sample
// (packages/sdvtables/test/fixtures/standings.ts, from nflverse games.csv)
const rows = [
  { team: "KC", wins: 15, pf: 385, pa: 326 },
  { team: "BUF", wins: 13, pf: 525, pa: 368 },
];
const data = {
  labels: ["Wins", "Points per game", "Allowed per game"],
  datasets: rows.map(({ team, wins, pf, pa }) => ({
    label: team,
    data: [wins, pf / 17, pa / 17],
    fill: true,
    backgroundColor: teamFill(team, "nfl"), // rgba(r, g, b, 0.2)
    borderColor: teamColor(team, "nfl"),
    pointBackgroundColor: teamColor(team, "nfl"),
    pointBorderColor: "#fff", // radar.ts:70-80 rings each point in white
    pointHoverBackgroundColor: "#fff",
    pointHoverBorderColor: teamColor(team, "nfl"),
  })),
};
```

Faint team logos behind a line (Game on Paper's win-probability chart). Pass `[home, away]`: the line is the home win
probability, so the home logo sits top-left of the chart area and the away logo bottom-left, at 0.4 opacity and 75 px
tall by default:

```ts
import { logoWatermarks, teamColor } from "@sportsdataverse/sdvplot/chartjs";
const dark = matchMedia("(prefers-color-scheme: dark)").matches;
new Chart(canvas, {
  type: "line",
  data: {
    datasets: [{ data: series.PHI, borderColor: teamColor("PHI", "nfl"), pointRadius: 0 }], // series: above
  },
  options: { scales: { x: { type: "linear" } } }, // minutes played
  plugins: [logoWatermarks(["PHI", "KC"], { league: "nfl", variant: dark ? "dark" : "default" })],
});
```

Two teams' win-probability (or EP) lines in colours that tell them apart, per theme:

```ts
const { light, dark: darkPair } = await matchupColors("PHI", "KC", { league: "nfl" });
const [home, away] = (dark ? darkPair : light);
// datasets: [{ label: "PHI", data: series.PHI, borderColor: home }, { label: "KC", data: series.KC, borderColor: away }]
```

Logos on a category axis (2024 wins, from the repo's real STANDINGS sample):

```ts
new Chart(canvas, {
  type: "bar",
  data: { labels: ["KC", "BUF", "LAC"], datasets: [{ data: [15, 13, 11], backgroundColor: teamColor(["KC", "BUF", "LAC"], "nfl") }] },
  plugins: [axisLogos("x", { league: "nfl", size: 28 })],
});
```

A shot chart over a court (and a hexbin as bubbles at the hex centres). `shots` is stats.nba.com `shotchartdetail`
rows with `LOC_X`/`LOC_Y` as `x_legacy`/`y_legacy` (the frame's defaults), e.g. the repo's real `NBA_SHOTS`
(`examples/src/data.ts`): the 38 fourth-quarter shots of the Lakers at the Nuggets, 2023-10-24.

```ts
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import { surface } from "@sportsdataverse/sdvplot/chartjs/surface";
import { hexbin } from "d3-hexbin";
const court = surface("nba", { team: "DEN", displayRange: "defense" });
const pts = toSurfaceFrame(shots, { from: "nba-legacy" })
  .map((s) => ({ x: s.surface_x ?? Number.NaN, y: s.surface_y ?? Number.NaN }));
const bins = hexbin<{ x: number; y: number }>().x((d) => d.x).y((d) => d.y).radius(1.5)(pts); // radius in feet
const [x0, y0, x1, y1] = court.scene.bbox;
new Chart(canvas, {
  type: "bubble",
  data: { datasets: [{ data: bins.map((b) => ({ x: b.x, y: b.y, r: 2 * Math.sqrt(b.length) })) }] },
  options: { scales: court.scales, aspectRatio: (x1 - x0) / (y1 - y0), plugins: { legend: { display: false } } },
  plugins: [court.plugin],
});
```

- Plugins are fixed when the chart is created (`new Chart`): to change the watermark teams or the court, destroy the chart and create a new one.
- Sizes are pixels: `radius` (point styles), `size` (axis logos, watermarks) — Chart.js draws an image at its own size.
- Add `pointImages` to `plugins` with any `*Points`: Chart.js does not redraw when an `<img>` finishes loading.
- An unknown team draws its own label as text (or pass `fallback: "circle"`), with one warning per call; the text is
  grey on a light chart and light grey on a dark one (`background`, default white, or black with `variant: "dark"`).
- Dark theme: `variant: "dark"` (read `prefers-color-scheme` as Game on Paper does); a team with no dark mark falls back to a light one by polarity, so no `onerror` retry is needed.
- Two teams on one chart: `teamColor(team, league, { which: "secondary" })` is the alternate. For a two-team chart use `matchupColors` (above).
- `axisLogos` needs a category axis (any other scale is left as it is, with one warning); on `y` the axis widens to the widest mark, so wordmarks fit; unresolved labels keep their text; your own scale options are not modified, and replacing `chart.options` (`chart.options = next; chart.update()`) keeps the logos.
- `surface` paints before the datasets, clipped to the chart area, through the chart's own scales (so it follows
  resizes and a reversed axis); keep both axes linear (`court.scales`; any other scale is left unpainted, with one
  warning). An `xlim` or `ylim` of zero width throws `InputError` when the surface is built. With `logoWatermarks` on the
  same chart, list `court.plugin` first: both paint before the datasets, in `plugins` order (the wrong order warns once).
  `aspectRatio` sizes the canvas, not the chart area, so the axes and the legend skew the court's proportions by a few
  percent: hide the legend (as above) and match the court's aspect through layout padding for undistorted circles. On a
  reversed x axis the football field's yard numbers render mirrored; courts and rinks are unaffected (limitation: a
  follow-up in sporty so `drawScene` keeps text upright). It needs
  `@sportsdataverse/sporty`, as `sdvplot/d3` does.
- Destroying a chart drops its pending image listeners, so unmounting before the logos arrive is safe.

### Server-side rendering (Node)

Pass `loadImage` and no DOM image is made: Chart.js renders on `@napi-rs/canvas` (server-rendered PNGs, social
cards). `@napi-rs/canvas`'s own `loadImage` fits as it is; wrap it to keep the promises, and once they settle the chart
is complete:

```ts
import { writeFile } from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { Chart, registerables } from "chart.js";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoWatermarks, teamColor } from "@sportsdataverse/sdvplot/chartjs";

Chart.register(...registerables);
await loadLeague("nfl");
const loads: Promise<unknown>[] = [];
const load = (url: string) => {
  const p = loadImage(url); // fetches the CDN URL
  loads.push(p);
  return p;
};
const canvas = createCanvas(800, 450);
const chart = new Chart(canvas as unknown as HTMLCanvasElement, {
  type: "line",
  data: {
    // wp: Super Bowl LIX's win probability for Philadelphia (above)
    datasets: [{ data: wp.map((p) => ({ x: p.minute, y: p.home_wp })), borderColor: teamColor("PHI", "nfl"), pointRadius: 0 }],
  },
  options: { responsive: false, animation: false, scales: { x: { type: "linear" } } },
  plugins: [logoWatermarks(["PHI", "KC"], { league: "nfl", loadImage: load })],
});
await Promise.all(loads); // each image redraws the chart as it lands, before this resumes
await writeFile("wp.png", canvas.toBuffer("image/png"));
chart.destroy();
```

- Every image helper takes it: `logoPoints`, `wordmarkPoints`, `headshotPoints`, `axisLogos`, `logoWatermarks`. Point
  styles still need `pointImages` in `plugins`, which updates the chart as they land.
- `loadImage` is called once per URL and drawn size (per loader function), and the image's `width` and `height` are set
  to that size, so resolve a new image on every call, as `@napi-rs/canvas`'s does (a loader that hands out one shared image warns once and skips the use at a different size). Await `Promise.all(loads)` after `new Chart(...)`, since `axisLogos` first calls the loader inside it.
- In Node an unknown team's text fallback is a circle (there is no canvas to letter it on); pass `fallback` for another
  style. A load that fails warns once and is skipped.

## Shot charts

`sdvplot/shots` computes the shot charts of both blazing-the-nets apps (`main` by default, the 2021 `master` through
options) with no Plot or d3 import; `sdvplot/plot` and `sdvplot/d3` draw them. The input is `nba_stats_shots` release
rows: `x_legacy`/`y_legacy` in tenths of a foot from the hoop, `shot_distance` in feet, `shot_value` (2 or 3) and
`shot_result` (`"Made"` or `"Missed"`). Master-style rows (stats.nba.com `shotchartdetail`) map with one `.map`;
only the zones read `shot_value`:

```ts
const shots = rows.map((r) => ({
  x_legacy: r.LOC_X,
  y_legacy: r.LOC_Y,
  shot_distance: r.SHOT_DISTANCE,
  shot_result: r.SHOT_MADE_FLAG === 1 ? "Made" : "Missed",
  shot_value: r.SHOT_TYPE === "3PT Field Goal" ? 3 : 2,
}));
```

`main`'s chart, hoop at the bottom: colour is the cell's FG% against the league's in the same cell, size is attempts.

```js
import * as Plot from "@observablehq/plot";
import { shotCells, surface } from "@sportsdataverse/sdvplot/plot";
import { cellsVsLeague, diffScale, leagueIndex, sizeCells } from "@sportsdataverse/sdvplot/shots";

const index = leagueIndex(leagueShots, 15); // the league's season in 1.5 ft hexagons (radius in tenths of a foot)
const cells = cellsVsLeague(playerShots, index); // a cell under 25 league attempts takes its zone's league FG%
const court = surface("nba", { displayRange: "defense", rotation: 90 });
Plot.plot({
  ...court.scales,
  width: 500,
  marks: [...court.marks, shotCells(cells, { r: sizeCells(cells, index).r, frame: "nba-legacy-vertical" })],
});
Plot.legend({ color: diffScale().plot }); // the matching colour key
```

Zones are `shotZones(basketballZones("nba", { scale: 10 }), { fill, text, frame: "nba-legacy-vertical" })` over
`statsByZone(shots)` (the shots' frame, so the zones sit under them on this court), and the
shooting signature is `shootingSignature(signaturePoints(vsLeague(fgPctByDistance(player), fgPctByDistance(league))))`.
The d3 twins are `appendLegend` (colour bar plus a cell size key) and `appendSignature`. The shot-charts guide,
<https://plot.sportsdataverse.org/guides/shot-charts>, draws each one.

`main` against `master`:

| Setting | `main` (default) | `master` |
| --- | --- | --- |
| League baseline | `cellsVsLeague(player, leagueIndex(league, 15))`: the league in the same cell | `cellsVsDistance(player, fgPctByDistance(league))`: the league at the cell's distance (radius 10 by default). The distance is `Math.hypot`: master's `sqrt` read 13 of BKN's 374 cells, those a whole number of feet out, one foot short |
| Size (`sizeCells` `rule`) | `"sqrt-p95"` | `"linear-cap"` |
| Colour prior in attempts (`shotCells` and `signaturePoints` `prior`, `shrunkDiff`'s `k`) | 25 | 0 |
| Palette (`diffScale` `palette`) | `"rdbu"` | `"master"` |
| Signature curve (`shootingSignature`, `appendSignature` `curve`) | `"monotone-x"` | `"basis"` |
| Signature half-width (`shootingSignature` `halfWidth`, in y units) | the default, `max(share / maxShare * 20, 0.75) / 190` | `(p) => (1 + p.share * 199) / 200` (in `appendSignature`'s pixels on master's 200 px axis, `(p) => 1 + p.share * 199`) |
| Legend span (`appendLegend` `domain` and `ticks`) | the scale's ends (±0.15 for `"rdbu"`), ticks at the ends and 0 | `{ domain: [-0.3, 0.3], ticks: [-0.3, -0.15, 0, 0.15, 0.3] }` |
| `signaturePoints` options | the defaults, `{ step: 0.25, smooth: true, minAttempts: 5, prior: 25 }` | `{ step: 1, smooth: false, minAttempts: 1, prior: 0 }` |
| `statsBySide` `centreHalfWidth` (4th argument) | `0`: `x == 0` is centre | `false`: `x == 0` is dropped |

- Hexagons or squares (J38): every lattice option takes `{ radius }` (hexagons, as both apps), `{ shape: "square", side }`,
  or `{ shape: "square", radius, equalArea: true }` (squares of that hexagon's area). Pass the same `shape` to
  `shotCells` and to `appendLegend`'s `size` key. `binner` bins any x/y data, not only shots.
- The binners (`hexbin`, `squarebin`, `binner`, `hexagonPath`, `squarePath`, `cellPath`, `cellPoints`) import from
  `sdvplot/shots` or from the sporty-free `sdvplot/bins`. The types the Plot and d3 marks take (`CellVsLeague`,
  `SignaturePoint`, `DiffScale`, `BinShape`) are exported from `sdvplot/shots`, and `BinShape` from `sdvplot/bins` too,
  not from `sdvplot/plot` or `sdvplot/d3`.
- `shootingSignature` does not clamp y: the ribbon's edges are `fgPct ± halfWidth`, so near 0% or 100% they pass a
  [0, 1] domain (`main` clamps the ribbon's centre, which misstates FG%). Pass `y: { domain: [0, 1], clamp: true }` to
  clamp. `appendSignature` uses your `y` scale as it is; a clamped scale clamps the centre.
- Marks paint in array order, so zone fills after `...court.marks` dim the court lines under them. Drawing the court
  last would hide the zones under its floor; for lines on top, add a second `surface` after the zones whose
  `colorUpdates` set `plot_background`, `defensive_half_court`, `offensive_half_court`, `court_apron`,
  `two_point_range`, `painted_area`, `center_circle_fill` and `free_throw_circle_fill` to `"#00000000"`.
- Faces: `appendHeadshots(…, { clip: "circle", ring, placeholder })` draws circular headshots. The image is drawn 2.3
  radii tall so the head fills the circle, so `drawnMarks` reports 1.15 × `height` for a face.
- `<Headshot fallback="initials" name="…">` (React) shows the player's initials when there is no headshot or it fails
  to load, server-rendered pages included. The initials box reads a new CSS variable, `--sdv-line` (its background;
  default `#e2e2e2`), and `--sdv-muted` for the text.

## Export (Node; peer: @resvg/resvg-js)

`sdvplot/export` turns an SVG figure into a PNG with `@resvg/resvg-js`, an optional peer
(`pnpm add -D @resvg/resvg-js`; without it `toPNG` throws `OptionalDependencyError`). `socialCard` frames the figure
for a social post the way sdvplot's and sdvplotR's `gt_social_crop` do: padded, then the short side extended to the
ratio, never cropped.

```ts
import { writeFile } from "node:fs/promises";
import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { socialCard, toPNG } from "@sportsdataverse/sdvplot/export";
import { logos } from "@sportsdataverse/sdvplot/plot";
import { JSDOM } from "jsdom";

await loadLeague("nfl");
// 2024 AFC regular season, points for and against (nflverse games)
const afc = [
  { team: "KC", pf: 385, pa: 326 },
  { team: "LAC", pf: 402, pa: 301 },
  { team: "DEN", pf: 425, pa: 311 },
  { team: "LV", pf: 309, pa: 434 },
  { team: "BUF", pf: 525, pa: 368 },
  { team: "MIA", pf: 345, pa: 364 },
  { team: "NYJ", pf: 338, pa: 404 },
  { team: "NE", pf: 289, pa: 417 },
];
const svg = Plot.plot({
  document: new JSDOM("").window.document, // Plot in Node
  width: 640,
  inset: 24,
  grid: true,
  x: { label: "Points for" },
  y: { label: "Points against", reverse: true },
  marks: [logos(afc, { league: "nfl", x: "pf", y: "pa", team: "team" })],
});
const png = await toPNG(socialCard(svg.outerHTML, { aspect: "16:9", padding: 60 }), { width: 1600 });
await writeFile("afc.png", png);
```

- `toPNG(svg, { width, scale, background, color, images })` takes an SVG string or an element with `outerHTML`, and
  adds the `xmlns` declarations an HTML-serialized figure lacks. Remote `<image>`s (logos, headshots) are downloaded
  once each, at most 8 at a time; a failed download throws `DownloadError`, and `images: "skip"` leaves them out with
  one warning. `color` is what `currentColor` (Plot's axes and text) resolves to; by default the SVG's own
  root `color`, else black or white, whichever contrasts more with `background`.
- `socialCard(svg, { aspect, padding, background, gravity, color })`: `aspect` is `"1:1"` (the default), `"16:9"`,
  `"4:5"`, `"9:16"`, `"1.91:1"`, `"4x5"` or a number, and `gravity` is one of the nine ImageMagick names. Python's and
  R's final `width=` rescale is `toPNG(…, { width })`.
- `toPNG` draws SVG only. A Plot figure with a `title`, `subtitle`, `caption` or legend is an HTML `<figure>`: pass the
  `<svg>` inside it (`figure.querySelector("svg")`), which leaves out the HTML parts.
- Tables go to PNG through `@sportsdataverse/sdvtables/export` (playwright).

## Data provenance

Curation lives only in the Python `sdvplot` repo (spec J4); this package ships generated per-league `.ts` shards (J13, `src/data/**`, never hand-edited) and a best-marks slice of the CDN manifest (J14), regenerated with `SDVPLOT_PY_REPO=… pnpm build:index` (which also writes `src/data/CHECKSUMS`) and drift-gated in CI by `pnpm build:index --check` (digest verification). Regenerate with:

```sh
SDVPLOT_PY_REPO=/path/to/sdvplot pnpm build:index
```

Parity is enforced by the Python oracle (`pnpm oracle:sdvplot`): the test suite replays every input × resolve/team colours/logo URLs/palette, plus headshot cases, against the Python package and requires 100% agreement.

## Owner steps (before the first publish)

1. Create the `sportsdataverse` organization on npm.
2. Enable OIDC trusted publishing for `@sportsdataverse/sdvplot` (repository `sportsdataverse/sdvplot-js`, release workflow).
3. Formalize the J3 licence understanding in writing before first publish (spec §9).

## License

MIT. See [NOTICE.md](NOTICE.md) for the sdvplot/sdvplotR material.
