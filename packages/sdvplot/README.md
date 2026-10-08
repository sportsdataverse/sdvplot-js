# **@sportsdataverse/sdvplot** <a href='https://plot.sportsdataverse.org/'><img src='https://raw.githubusercontent.com/sportsdataverse/sdvplot-js/main/docs/static/img/sdvplot-js-logo.png' align="right" width="25%" min-width="120px" alt="sdvplot-js hex logo" /></a>

<!-- badges: start -->

[![npm](https://img.shields.io/npm/v/@sportsdataverse/sdvplot?label=sdvplot&logo=npm&style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sdvplot)
[![Downloads](https://img.shields.io/npm/dm/@sportsdataverse/sdvplot?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sdvplot)
[![Total downloads](https://img.shields.io/npm/dt/@sportsdataverse/sdvplot?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sdvplot)
[![Node](https://img.shields.io/node/v/@sportsdataverse/sdvplot?logo=nodedotjs&logoColor=white&style=for-the-badge)](https://nodejs.org/)
[![Unpacked size](https://img.shields.io/npm/unpacked-size/@sportsdataverse/sdvplot?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sdvplot?activeTab=code)
[![ci](https://img.shields.io/github/actions/workflow/status/sportsdataverse/sdvplot-js/ci.yml?branch=main&label=ci&logo=github&style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/actions/workflow/status/sportsdataverse/sdvplot-js/release.yml?branch=main&label=release&logo=github&style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/actions/workflows/release.yml)
[![docs](https://img.shields.io/github/deployments/sportsdataverse/sdvplot-js/Production?label=docs&logo=vercel&style=for-the-badge)](https://plot.sportsdataverse.org)
[![Lifecycle: experimental](https://img.shields.io/badge/lifecycle-experimental-orange.svg?style=for-the-badge&logo=github)](https://lifecycle.r-lib.org/articles/stages.html#experimental)
[![License](https://img.shields.io/github/license/sportsdataverse/sdvplot-js?style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/blob/main/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/sportsdataverse/sdvplot-js?style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/graphs/contributors)
[![Twitter Follow](https://img.shields.io/twitter/follow/SportsDataverse?color=blue&label=%40SportsDataverse&logo=x&style=for-the-badge)](https://x.com/SportsDataverse)

<!-- badges: end -->

Team identity, colors, logos, wordmarks and headshots for SportsDataverse plots. TypeScript port of the Python `sdvplot` package (and `sdvplotR`).

Part of [sdvplot-js](https://github.com/sportsdataverse/sdvplot-js#readme) · [Documentation](https://plot.sportsdataverse.org) · [API reference](https://plot.sportsdataverse.org/api/sdvplot/) ·
[Gallery](https://plot.sportsdataverse.org/gallery/sdvplot/) · [Notebooks](https://plot.sportsdataverse.org/notebooks/) · [Source](https://github.com/sportsdataverse/sdvplot-js/tree/main/packages/sdvplot)

## **Installation**

```sh
npm install @sportsdataverse/sdvplot
# or
pnpm add @sportsdataverse/sdvplot
# or
yarn add @sportsdataverse/sdvplot
```

ESM only, Node >= 20.18.1. The core and the `bins`, `testing`, `plotly`, `vega` and `echarts` subpaths need no
peer. The others use optional peers, which npm and pnpm do not install for you, so add the ones for the subpaths you
import: `react` >= 18 for `/react`, `@observablehq/plot` >= 0.6.16 for `/plot`, `d3` >= 7 for `/d3` and `/interact`,
`chart.js` >= 4.4 for `/chartjs` and `/chartjs/surface`, and `@resvg/resvg-js` for `/export`'s `toPNG`.

`/plot`, `/d3`, `/shots` and `/chartjs/surface` also need `@sportsdataverse/sporty`, whether or not you draw a
surface: they import it when they load, and fail to load without it. No other subpath imports sporty. For a Plot chart:

```sh
npm install @sportsdataverse/sdvplot @sportsdataverse/sporty @observablehq/plot
```

The table under [Subpaths](#subpaths) lists each subpath's peers.

## **Quick start**

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

## **Two-team colours**

`matchupColors(teamA, teamB, { league })` picks colours that tell two teams apart on one chart (Game on Paper's "game colours"). It returns one `[teamA, teamB]` pair per theme: each colour reads at WCAG 2.5:1 or better on that theme's background, and the two are at least 20 apart in CIEDE2000. The primaries are kept whenever they work; otherwise teamB's secondary is tried, then teamA's, then both, and only then is a colour's lightness moved.

```ts
import { matchupColors } from "@sportsdataverse/sdvplot";

const { light, dark } = await matchupColors("Alabama", "Georgia", { league: "cfb" });
// light: ["#9e1b32", "#2c2a29"]  (Georgia's crimson is too close to Alabama's)
// dark:  ["#ffffff", "#ba0c2f"]  (Alabama's crimson does not read on the dark background)
const [home, away] = window.matchMedia("(prefers-color-scheme: dark)").matches ? dark : light;
```

The backgrounds default to `#ffffff` (light) and `#181a1b` (dark); pass `theme: { light, dark }` for your own. `matchupColorsSync` is the same once the league is loaded. Parity: the pairs match Game on Paper's `pickGameColors` exactly on 69 real college-football matchups (`fixtures/matchup-colors`).

## **Subpaths**

| Import | Contents |
| --- | --- |
| `@sportsdataverse/sdvplot` | `resolve`, `suggest`, `teams`, `rowsFrom`, `palette`, `teamColors`, `matchupColors`, `logoUrl`, `marks` (`full: true` fetches the whole manifest lazily), `selectMark`, `selectMarkSync`, `place`, `placeSync`, `prepareTiers`, `headshotUrl`, `loadGsis`, contrast helpers (`hex6`, `luminance`, `contrast`, `onColor`, `mix`, `solid`), the selection store `createSelection` with `focusIds`, `toId`, `sameIds`, `sameCursor` (see [Linked interactivity](#linked-interactivity)), `versions`, errors, types |
| `@sportsdataverse/sdvplot/react` | `TeamLogo`, `Wordmark`, `Headshot`, `useTeamColors`, `useResolve`, `useSelection` (re-renders on every change of a selection store) (React >= 18, optional peer) |
| `@sportsdataverse/sdvplot/plot` | Observable Plot marks and scales: `logos`, `wordmarks`, `headshots`, `axisLogos`, `teamColor`/`teamFill`, `meanLines`/`medianLines`, `titleImage`, `teamTiers`, `surface`, shot-chart marks `shotCells`, `shotZones`, `shootingSignature`, `linkIds` (stamps any mark's link ids; the image marks take an `id` option) (needs `@observablehq/plot` and `@sportsdataverse/sporty` installed to import) |
| `@sportsdataverse/sdvplot/d3` | `appendLogos`, `appendWordmarks`, `appendHeadshots` (circular faces: `clip`, `ring`, `placeholder`), `teamColorScale`, `appendSurface`, shot-chart `appendLegend` and `appendSignature` (needs `d3` and `@sportsdataverse/sporty` installed to import) |
| `@sportsdataverse/sdvplot/bins` | Dependency-free x/y binning for any data: `hexbin` and `hexagonPath` (a d3-hexbin port), `squarebin` and `squarePath`, `binner` (hexagons, squares, or equal-area squares from one options object), `cellPath`, `cellPoints` |
| `@sportsdataverse/sdvplot/shots` | Shot-chart data and colour, no Plot or d3: the `./bins` binners, `diffScale`, `binShots`, `leagueIndex`, `cellsVsLeague`, `cellsVsDistance`, `shrunkDiff`, `LEAGUE_PRIOR_ATTEMPTS`, `sizeCells`, `statsByZone`, `fgPctByDistance`, `vsLeague`, `statsBySide`, `signaturePoints` (needs `@sportsdataverse/sporty` installed to import; `./bins` has the binners without it) |
| `@sportsdataverse/sdvplot/chartjs` | Chart.js 4: `logoPoints`, `wordmarkPoints`, `headshotPoints`, `pointImages`, `axisLogos`, `logoWatermarks`, `teamColor`/`teamFill` (optional peer `chart.js` >= 4.4; no sporty needed) |
| `@sportsdataverse/sdvplot/chartjs/surface` | Chart.js 4 court, field or rink background: `surface` (needs `@sportsdataverse/sporty` installed to import; optional peer `chart.js` >= 4.4) |
| `@sportsdataverse/sdvplot/export` | Node only: `toPNG` (SVG to PNG; optional peer `@resvg/resvg-js`), `socialCard` (fixed-ratio framing, `gt_social_crop`), `svgSize`, `parseAspect`, `parseGravity`, `checkColor`, `canvasFor`, `offsetFor`, `peerMissing` |
| `@sportsdataverse/sdvplot/interact` | Linked figures over a selection store: `brushFilter` (a d3-brush overlay behind the marks writes the brushed ids and region; on a figure with a Plot `tip`, the press that starts a brush also pins the tip showing at that moment), `highlight`, `linkSelection` (one figure or one sdvtables table per call: hover and selection both ways, and a brush filters a linked table; a Plot `tip` hovers through `hover: { id }`), `linkCursor` (the store's `cursor`, one shared hover value such as a shot distance, drawn and emitted through each figure's own scale as a rule, a band or a ring around the hoop; unrelated to sdvtables' keyboard `TableCursor`), `nearestHover` (the nearest mark of a d3 or other non-Plot figure within a radius writes `hover`), `tooltip` (an in-SVG tooltip box for non-Plot figures), `hasDom` (optional peer `d3`; inert without a DOM) |
| `@sportsdataverse/sdvplot/testing` | Adapter-contract suite for renderer adapters: `checkAdapterContract`, `drawnMarks`, `drawnAxisMarks`, `visibleAxisLabels` |
| `@sportsdataverse/sdvplot/plotly` | `withLogos`, `withWordmarks`, `withHeadshots`, `withAxisLogos`, `teamColorway`, `embedSources` (no runtime dependency) |
| `@sportsdataverse/sdvplot/vega` | `withLogos`, `withWordmarks`, `withHeadshots`, `logoLayer`, `withAxisLogos`, `teamColorScale`, `embedSources` (no runtime dependency) |
| `@sportsdataverse/sdvplot/echarts` | `withLogos`, `withWordmarks`, `withHeadshots`, `withAxisLogos`, `teamColorPalette`, `embedSources` (no runtime dependency) |

## **Observable Plot: Plot's own options, transforms and tips**

The `sdvplot/plot` marks compute only what Plot cannot: each row's image URL, its aspect, its size as a fraction of
the frame, and skip-and-warn for a team that does not resolve. Everything else is Observable Plot's. The image marks
(`logos`, `wordmarks`, `headshots`) take every `Plot.image` option except `src`, `width`, `height`, `r` and
`preserveAspectRatio`: `x` and `y` (a field name, an accessor or an array), `tip`, `href` and `target`, `title`, `fx`
and `fy`, `sort`, `filter` and `reverse`, `dx` and `dy`, `className`, `clip`, `opacity` and `channels`. `axisLogos`,
`meanLines` and `medianLines` take Plot's options too, `teamTiers` takes `tip`, and the shot marks take both
([Shot charts](#shot-charts)).

- Plot's row-preserving transforms wrap the image marks: `Plot.dodgeY` and `Plot.dodgeX` (a logo beeswarm),
  `Plot.stackY`, `Plot.windowY`, `Plot.selectLast` and `Plot.pointer`. A transform that makes new rows (`Plot.bin`,
  `Plot.group`, `Plot.hexbin`) throws `InputError`, because one image per input row cannot survive it: aggregate the
  rows first, then draw the result.
- `height` stays a fraction of the frame, or of each facet's frame under `fx` or `fy`.
- Column-name `x` and `y` label the axes, as on any Plot mark (`x: "wins"` gives `wins →`); pass
  `x: { label: null }` to `Plot.plot` to hide one.
- Under a dodge, `r` is the collision radius in pixels. Half the drawn height makes neighbours just touch; a smaller
  `r` lets them overlap. It never clips or sizes an image. Plot's own image mark uses `r` to clip the image to a
  circle, while sdvplot uses `r` only for dodge spacing and never clips.
- `alpha` is the Python sdvplot name for a constant `opacity`, kept for parity; Plot's `opacity` also takes a per-row
  channel. Passing both throws `InputError`.
- A `render`, `transform` or `initializer` you pass is composed with sdvplot's, never replaced: your `render` sees the
  sized image, and `Plot.pointer` stays outermost.

```js
import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos, meanLines } from "@sportsdataverse/sdvplot/plot";

await loadLeague("nfl");
// The 2024 AFC West and East (regular season): wins and points for from the repo's STANDINGS sample
// (packages/sdvtables/test/fixtures/standings.ts, nflverse games.csv); net EPA per rush or pass play, offence minus
// defence, from fixtures/examples/nfl_epa_2024_reg.csv (nflverse play_by_play_2024)
const afc = [
  { team: "KC", division: "West", wins: 15, pf: 385, net_epa: 0.063 },
  { team: "LAC", division: "West", wins: 11, pf: 402, net_epa: 0.101 },
  { team: "DEN", division: "West", wins: 10, pf: 425, net_epa: 0.108 },
  { team: "LV", division: "West", wins: 4, pf: 309, net_epa: -0.146 },
  { team: "BUF", division: "East", wins: 13, pf: 525, net_epa: 0.19 },
  { team: "MIA", division: "East", wins: 8, pf: 345, net_epa: -0.019 },
  { team: "NYJ", division: "East", wins: 5, pf: 338, net_epa: -0.045 },
  { team: "NE", division: "East", wins: 4, pf: 289, net_epa: -0.162 },
];

// A beeswarm: the frame is 150 - 20 - 30 = 100 px, so each logo is 0.2 x 100 = 20 px tall and r = 10 px touches
const beeswarm = Plot.plot({
  height: 150,
  marginTop: 20,
  marginBottom: 30,
  marks: [logos(afc, Plot.dodgeY({ league: "nfl", team: "team", x: "net_epa", r: 10, height: 0.2 }))],
});

// Small multiples: mark-level fx, one facet per division, each with its own mean
const facets = Plot.plot({
  marks: [
    ...meanLines(afc, { x: "wins", fx: "division" }),
    logos(afc, { league: "nfl", x: "wins", y: "pf", team: "team", fx: "division", height: 0.15 }),
  ],
});
```

### Tips and the figure's value

`tip: true` adds Plot's own tip, opt-in as everywhere in Plot. The default channels are the team, named as its image
is ("KC" for rows keyed by `team_id` too; the player id for headshots), with `x` and `y` on the image marks; attempts, FG%, league FG% and the shrunk difference on `shotCells`;
the zone, and given `stats` its makes/attempts and FG%, on `shotZones`; distance, FG%, league FG% and shot share on
`shootingSignature`. A tip object's `format` overrides sdvplot's formats key by key. What is under the pointer is the
figure's `value`, with an `input` event on each change, as for any Plot mark. A server-rendered figure carries one
empty tip group, inert until the page runs the chart.

```js
// Hover a logo for its team, wins and points for; each logo also links to its team's page
const fig = Plot.plot({
  marks: [
    logos(afc, {
      league: "nfl",
      x: "wins",
      y: "pf",
      team: "team",
      tip: true,
      href: (d) => `https://www.espn.com/nfl/team/_/name/${d.team.toLowerCase()}`,
      target: "_blank",
    }),
  ],
});
fig.addEventListener("input", () => console.log(fig.value?.team)); // "KC" while KC's logo is pointed at
```

### Accessible names

Every image an SVG renderer draws is named by its subject: "KC logo", "KC wordmark", "3139477 headshot". Logos and
wordmarks are named by the resolved team whatever id system the rows use (`team_id` included), on the Plot image marks
and `axisLogos`, the Vega image layers and d3's `appendLogos`, `appendWordmarks` and `appendHeadshots`. On the Plot
marks `ariaLabel` is Plot's per-image channel, so a string is a column name (`ariaLabel: "qb"`) and an accessor or an
array gives any other text; the d3 helpers take `ariaLabel: (value, i) => text`. `shotZones` names each path by its
zone and `shotCells` each cell by its makes, attempts and FG% ("147 of 181 made, 81.2%"), the shooting signature's
ribbon is named in Plot and d3, `appendLegend` names its colour bar, a titled `teamTiers` figure is labelled by its
title, and `ariaDescription` passes through to a mark's group. sporty describes every surface it draws ("nba
basketball surface"; `ariaDescription` replaces it): `surfaceMark`, `toSVG` and d3's `appendSurface`, sdvplot's
included. Plotly, ECharts and Chart.js draw to a canvas or to layout images, so
the chart is named through each library (see each adapter below).

## **Spec adapters (Plotly, Vega-Lite, ECharts) — zero runtime deps**

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
Accessible name: plotly.js has no accessibility option and layout images carry no name, so name the chart on the
element you pass to `Plotly.newPlot` (`role="img"` and an `aria-label`).

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
below that. The helper series have no `name`, so a default `legend: {}` lists only your series. Accessible name:
`aria: { enabled: true, label: { description: "…" } }` gives the chart's container `role="img"` and that `aria-label`
(in the browser; server-side rendering writes none); without a `description` ECharts writes one from every series,
the logo series too.

## **Chart.js (Astro, Svelte, React, plain scripts)**

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
- Accessible name: Chart.js adds none (it draws pixels), so name the chart on the canvas: `role="img"` and an
  `aria-label`, or fallback content between `<canvas>` and `</canvas>`.

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

## **Shot charts**

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
- Hover: `tip: true` on `shotCells`, `shotZones` (given `stats: statsByZone(shots)`, each zone's makes/attempts) and
  `shootingSignature` ([tips](#tips-and-the-figures-value)). `shotCells` leaves out a cell centred outside the plot's
  frame (`dropOutside`, default `true`; it was `clip`), so a tip never points at a cell that is not drawn, and Plot's
  own `clip` passes through. The shot marks draw your `cells` and `areas` as the mark's data, so `fx`/`fy`,
  `channels` and the tip read your fields; every other Plot geo option passes through. As on the image marks, a
  `transform` or `initializer` that makes new rows (`Plot.group`, `Plot.hexbin`) throws `InputError`.
- Linking: each cell's path carries `data-sdv-id` `"x,y"` (its legacy centre) and each zone's its name, so
  `linkSelection(store, { figure, select: "toggle" })` from `sdvplot/interact` toggles them by click, Enter or Space.
  Hexagon ids and zone names are two id spaces, so give the cells and the zones a store each. A zone's label passes
  the pointer through to its zone. A click also pins Plot's tip, so give `shotCells` `tip: { pointerEvents: "none" }`
  (with your `maxRadius`): the pinned tip then never takes a click meant for a cell under it
  ([guide](https://plot.sportsdataverse.org/guides/shot-charts#linking)).
- The binners (`hexbin`, `squarebin`, `binner`, `hexagonPath`, `squarePath`, `cellPath`, `cellPoints`) import from
  `sdvplot/shots` or from the sporty-free `sdvplot/bins`. The types the Plot and d3 marks take (`CellVsLeague`,
  `SignaturePoint`, `DiffScale`, `BinShape`) are exported from `sdvplot/shots`, and `BinShape` from `sdvplot/bins` too,
  not from `sdvplot/plot` or `sdvplot/d3`.
- `shootingSignature` does not clamp y: the ribbon's edges are `fgPct ± halfWidth`, so near 0% or 100% they pass a
  [0, 1] domain (`main` clamps the ribbon's centre, which misstates FG%). Pass `y: { domain: [0, 1], clamp: true }` to
  clamp. `appendSignature` uses your `y` scale as it is; a clamped scale clamps the centre.
- Marks paint in array order. `shotZones` returns the zone paths, then the labels, then the tip, and
  `shootingSignature`'s tip is its last mark too, so spread these marks last, or add other marks before them: a mark
  added after them paints over the tip. Zone fills after `...court.marks` dim the court lines under them, and drawing
  the court last would hide the zones under its floor. For lines on top, put a second `surface` right after the zone
  paths, its `colorUpdates` setting `plot_background`, `defensive_half_court`, `offensive_half_court`, `court_apron`,
  `two_point_range`, `painted_area`, `center_circle_fill` and `free_throw_circle_fill` to `"#00000000"`:
  `const [paths, ...rest] = shotZones(areas, o)`, then `marks: [...court.marks, paths, ...lines.marks, ...rest]`.
- Faces: `appendHeadshots(…, { clip: "circle", ring, placeholder })` draws circular headshots. The image is drawn 2.3
  radii tall so the head fills the circle, so `drawnMarks` reports 1.15 × `height` for a face.
- `<Headshot fallback="initials" name="…">` (React) shows the player's initials when there is no headshot or it fails
  to load, server-rendered pages included. The initials box reads a new CSS variable, `--sdv-line` (its background;
  default `#e2e2e2`), and `--sdv-muted` for the text.

## **Export (Node; peer: @resvg/resvg-js)**

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

## **Linked interactivity**

One selection store links any number of figures and tables. `createSelection()` holds the ids under the pointer
(`hover`), the picked ids (`selected`), a brush region as a row test (`predicate`) and one shared hover value
(`cursor`, such as a shot distance). A change notifies each subscriber once, and a change that changes nothing notifies
nobody, so linked views cannot ping-pong. A figure's marks carry their link id as `data-sdv-id`: the `id` option on
`logos`/`wordmarks`/`headshots`, `render: linkIds(rows, "team")` on any other Plot mark, or
`.attr("data-sdv-id", (d) => d.team)` in d3. A table carries the same ids through its spec's `rowKey`.

```js
import * as Plot from "@observablehq/plot";
import { createSelection } from "@sportsdataverse/sdvplot";
import { brushFilter, linkSelection } from "@sportsdataverse/sdvplot/interact";
import { linkIds } from "@sportsdataverse/sdvplot/plot";
import { createTable, defineTable } from "@sportsdataverse/sdvtables";
import { hydrate, renderHTML } from "@sportsdataverse/sdvtables/html";

// 2024 AFC: wins and net EPA per play (nflverse). NE has none, so it has no dot and a brush never holds it.
const rows = [
  { team: "KC", wins: 15, net_epa: 0.063 },
  { team: "LAC", wins: 11, net_epa: 0.101 },
  { team: "DEN", wins: 10, net_epa: 0.108 },
  { team: "LV", wins: 4, net_epa: -0.146 },
  { team: "BUF", wins: 13, net_epa: 0.19 },
  { team: "MIA", wins: 8, net_epa: -0.019 },
  { team: "NYJ", wins: 5, net_epa: -0.045 },
  { team: "NE", wins: 4, net_epa: null },
];
const fig = Plot.plot({ marks: [Plot.dot(rows, { x: "wins", y: "net_epa", r: 6, render: linkIds(rows, "team") })] });
const spec = defineTable()
  .columns((c) => [c.text("team"), c.int("wins"), c.num("net_epa", { digits: 3 })])
  .rowKey("team")
  .build();
const table = createTable(spec, rows);
const host = document.createElement("div");
host.innerHTML = renderHTML(table); // or <SdvTable table={table} /> from @sportsdataverse/sdvtables/react
hydrate(host.querySelector(".sdvt"), table);

const store = createSelection();
linkSelection(store, { figure: fig }); // hover a dot: its row is underlined; a brush or a selection lights the dots
linkSelection(store, { table }); // hover or click a row: its dot lights; a brush filters the table
brushFilter(fig, store, { data: rows, x: "wins", y: "net_epa", id: "team" });
```

- **Highlighting** is a class toggle (`.sdv-focus` on the figure, `.sdv-hl` on the emphasised marks), never a redraw.
  Each store change touches only the marks whose state changed, and marks Plot draws later (a `Plot.pointer` layer)
  are lit as they appear. Axis logos (`axisLogos`) never dim and never hover.
- **Ids are strings and must match on both sides.** `toId` normalises them: `12` and `"12"` are one id, and null,
  NaN and `""` are none. An image mark without `id` is stamped with the resolved ESPN team id ("12" for KC; the player
  id on headshots), which never matches a table keyed by abbreviation: pass `id: "team"`. `linkSelection` warns once
  per figure when none of the focused ids is drawn.
- **Image marks link through `id`.** `render: linkIds(...)` also works on them, with or without `href`; when both are
  set, the outer `render` wins. With `href`, the stamp sits on the `<image>` inside the `<a>` (on any other mark, on
  the `<a>`), and `select: "toggle"` throws `InputError`, because a checkbox cannot sit inside a link.
- **A Plot figure with a `tip`** hovers through Plot's own pointer:
  `linkSelection(store, { figure: fig, hover: { id: (d) => d.team } })` writes the row Plot's tip picks. The `id`
  function must return the same key as the marks' `id`; otherwise the tip writes one id and the marks carry another.
  Pass `figure` as `Plot.plot` returned it (a `<figure>` when there is a caption or legend). On a figure with a `tip`,
  the press that starts a brush also pins the tip showing at that moment, as a press on any Plot tip does.
- **Linked tables.** A table holds one hover id, so it lights the first id the store hovers. Every interactive
  sdvtables table, linked or not, underlines the row under the pointer; drop it with
  `tr.sdvt-hover>td.sdvt-cell{background-image:none}` (sdvtables' README has the details).
- **`brushFilter(fig, store, { data, x, y, id, empty, scales })`** brushes x and y, or one alone along that axis. A
  brush holding no row dims every mark (`empty: "dim"`, the default) or, with `empty: "clear"`, is no filter and is
  removed when the gesture ends. A d3-drawn chart has no `figure.scale`, so it passes its own d3 scales as `scales`.
  The drawn rectangle follows the store: cleared from elsewhere (`store.clear()`), it goes without a second write. A
  click on empty chart area clears only this brush's region. The handle's `move(region)` brushes in data coordinates.
- **`linkSelection(store, { figure, select: "toggle" })`** turns each stamped mark into a checkbox (`role`,
  `tabindex="0"`, `aria-checked`): a click, Enter or Space toggles its id in `selected`. Each checkbox is named by the
  mark's own name, from Plot's `ariaLabel` or `title` channel, else by its link id. A mark stamped with an empty id (a
  missing key) stays a plain mark.
- **`linkCursor(fig, store, { field, shape })`** draws the store's `cursor` through this figure's own scale and writes
  the value under the pointer back: a rule, or a band `width` data units wide, on an x or y scale; the band holding the
  value on a band scale; or a ring around a centre (`axis: "ring"`, such as a shot distance around the hoop). A
  d3-drawn chart passes its d3 scales as they are (`d3.scaleLinear()`, `d3.scaleBand()`), as `brushFilter`'s `scales` do.
  Options: `snap`, `label` and `dot`. Moving inside one snapped bin writes nothing, and leaving the figure clears the
  cursor it wrote, never one another figure or `store.set` wrote since. A cursor is not an id: it never dims marks or
  filters a table. The store's `Cursor` is unrelated to
  sdvtables' `TableCursor`, the keyboard grid's current row.
- **`nearestHover(svg, store, { points, radius, dimension })`** hovers the nearest mark of a d3-drawn (or any
  non-Plot) figure within `radius` px, in the plane or along one axis, and its `label` option shows `tooltip`'s
  in-SVG box beside it. Link that figure with `hover: false`, so it has one hover writer.
  `tooltip(svg).show(x, y, lines, swatch)` draws the same box on its own.
- **Teardown.** `linkSelection` and `linkCursor` return a teardown function, since teardown is all they have
  (`useEffect(() => linkSelection(store, o), deps)` is one line); `brushFilter`, `nearestHover` and `tooltip` return a
  handle with `destroy()`, since they have more (`move`, `update`, `show`). `linkSelection` takes the store first because
  it links a figure, a table or both; the other calls take the element first.
  `linkSelection`'s teardown clears the hover its own link wrote, and `linkCursor`'s the cursor its own figure wrote,
  only while the store still holds exactly that value: another writer's survives. `linkSelection`'s teardown then
  restores the view it changed, so a figure or table unlinked and kept on the page shows no store state, even
  mid-brush: the figure un-dims (once the last link on it goes), toggled marks get their own attributes back, and the
  table drops the brush filter and the hover it showed. The store keeps the brush's region and any selection for the
  views still linked. **To replace a linked figure, tear its link down before linking the new one**; otherwise the
  new figure's first sync reads the old figure's hover and warns that none of the linked ids is drawn.
- **Styling.** Five CSS custom properties restyle the visuals with no JS, so a page's light and dark tokens reach
  them: `--sdv-dim-opacity` (default `0.2`, the dimmed marks), `--sdv-cursor-color` (default `rgba(0,0,0,.2)`),
  `--sdv-cursor-width` (default `10px`, the stroke of a rule or a ring; a band is filled), `--sdv-tip-bg` (default
  `rgba(34,34,34,.85)`) and `--sdv-tip-fg` (default `#ddd`, the text and the swatch outline).
- **Server rendering.** Without a DOM every interact call is a no-op (`hasDom()`), so server-rendered markup is
  unchanged; a bad option still throws `InputError` in Node. **React:** `useSelection(store)` (`sdvplot/react`)
  returns the store's state and re-renders on each change.

The docs run these live: [Linked figure and table](https://plot.sportsdataverse.org/examples/linked), and a five-chart
[linked shot dashboard](https://plot.sportsdataverse.org/examples/shot-dashboard) on one store.

## **Data provenance**

Curation lives only in the Python `sdvplot` repo (spec J4); this package ships generated per-league `.ts` shards (J13, `src/data/**`, never hand-edited) and a best-marks slice of the CDN manifest (J14), regenerated with `SDVPLOT_PY_REPO=… pnpm build:index` (which also writes `src/data/CHECKSUMS`) and drift-gated in CI by `pnpm build:index --check` (digest verification). Regenerate with:

```sh
SDVPLOT_PY_REPO=/path/to/sdvplot pnpm build:index
```

Parity is enforced by the Python oracle (`pnpm oracle:sdvplot`): the test suite replays every input × resolve/team colours/logo URLs/palette, plus headshot cases, against the Python package and requires 100% agreement.

## **Documentation**

The [**sdvplot-js** documentation website](https://plot.sportsdataverse.org) has the
[sdvplot gallery](https://plot.sportsdataverse.org/gallery/sdvplot/), the [notebooks](https://plot.sportsdataverse.org/notebooks/) and the
[sdvplot API reference](https://plot.sportsdataverse.org/api/sdvplot/), one page per subpath, plus:

**Guides:**
[Identity and resolution](https://plot.sportsdataverse.org/guides/identity) ·
[Team colours](https://plot.sportsdataverse.org/guides/colors) ·
[Logos, wordmarks, headshots](https://plot.sportsdataverse.org/guides/marks) ·
[Observable Plot](https://plot.sportsdataverse.org/guides/observable-plot) ·
[D3](https://plot.sportsdataverse.org/guides/d3) ·
[React](https://plot.sportsdataverse.org/guides/react) ·
[Plotly, Vega-Lite, ECharts and Chart.js](https://plot.sportsdataverse.org/guides/chart-libraries) ·
[Shot charts](https://plot.sportsdataverse.org/guides/shot-charts) ·
[Node and SSR](https://plot.sportsdataverse.org/guides/node-ssr) ·
[Export to PNG](https://plot.sportsdataverse.org/guides/export)

**Examples:**
[Basketball](https://plot.sportsdataverse.org/examples/basketball) ·
[Football](https://plot.sportsdataverse.org/examples/football) ·
[Hockey](https://plot.sportsdataverse.org/examples/hockey) ·
[Linked figures and tables](https://plot.sportsdataverse.org/examples/linked) ·
[A linked shot dashboard](https://plot.sportsdataverse.org/examples/shot-dashboard)

**Coming from elsewhere:**
[sdvplot (Python), sdvplotR and sportyR](https://plot.sportsdataverse.org/guides/migrating) ·
[Game on Paper (Chart.js + Astro/Svelte)](https://plot.sportsdataverse.org/guides/game-on-paper) ·
[blazing-the-nets (Next/React + d3)](https://plot.sportsdataverse.org/guides/blazing-the-nets)

The [repository README](https://github.com/sportsdataverse/sdvplot-js#readme) covers all three packages and development.

## **Logos, trademarks and data**

Team names, logos, wordmarks and player headshots are trademarks or copyrighted works of their respective leagues,
teams, schools and other rights holders. `@sportsdataverse/sdvplot` is not affiliated with, sponsored by or endorsed
by any of them, and using it to draw a mark grants no right to use it. The package ships no logo or headshot files:
it carries an index of team names, ids and colors and the addresses of the archived marks, and the marks are
fetched at runtime from the [SportsDataverse logo archive](https://github.com/sportsdataverse/sdv-assets),
headshots from ESPN (or, for NFL gsis ids, the headshot URLs in nflverse's player table). Use of any mark in your own
work is governed by that owner's terms, and following them is your responsibility.

The NFL team colors and the gsis-id headshot map behind `loadGsis()` come from
[nflverse-data](https://github.com/nflverse/nflverse-data) by the nflverse project, licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): headshot URLs, not images. The team index is curated in
[sdvplot](https://sdvplot.sportsdataverse.org/) (Python, MIT). The `bins` and `shots` subpaths port d3-hexbin,
d3-interpolate, d3-scale-chromatic (ColorBrewer's RdBu) and d3-array under their own licences.

The [MIT license](https://github.com/sportsdataverse/sdvplot-js/blob/main/LICENSE) covers the code; team data belongs to its respective owners and sources.
[NOTICE.md](https://github.com/sportsdataverse/sdvplot-js/blob/main/packages/sdvplot/NOTICE.md) records the sdvplot/sdvplotR, nflverse and d3 material and its licences.

## **The SportsDataverse**

`@sportsdataverse/sdvplot` is one of the three [sdvplot-js](https://github.com/sportsdataverse/sdvplot-js#readme) packages, with [`@sportsdataverse/sporty`](https://github.com/sportsdataverse/sdvplot-js/tree/main/packages/sporty#readme) and [`@sportsdataverse/sdvtables`](https://github.com/sportsdataverse/sdvplot-js/tree/main/packages/sdvtables#readme).

| Package | Sport / Scope |
| --- | --- |
| [**sdvplot**](https://sdvplot.sportsdataverse.org/) | The Python package sdvplot-js ports |
| [**sdvplotR**](https://sdvplotR.sportsdataverse.org/) | The R package sdvplot mirrors |
| [**sportyR**](https://github.com/sportsdataverse/sportyR) · [**sportypy**](https://sportypy.sportsdataverse.org/) | Playing-surface plots for R and Python, which `@sportsdataverse/sporty` ports |
| [**sportsdataverse.js**](https://js.sportsdataverse.org/) | SportsDataverse data for Node.js and TypeScript |
| [**sportsdataverse-py**](https://py.sportsdataverse.org/) | SportsDataverse data for Python: NFL, CFB, NBA, WNBA, MBB, WBB, MLB, NHL, PWHL, soccer and more |
| [**sportsdataverse-R**](https://r.sportsdataverse.org/) | The R packages: hoopR, wehoop, cfbfastR, fastRhockey, baseballr and more |

See the full ecosystem at [sportsdataverse.org](https://sportsdataverse.org/).

## **Follow the [SportsDataverse](https://x.com/SportsDataverse) on X and star this repo**

[![Twitter Follow](https://img.shields.io/twitter/follow/SportsDataverse?color=blue&label=%40SportsDataverse&logo=x&style=for-the-badge)](https://x.com/SportsDataverse)
[![GitHub stars](https://img.shields.io/github/stars/sportsdataverse/sdvplot-js.svg?color=eee&logo=github&style=for-the-badge&label=Star%20sdvplot-js&maxAge=2592000)](https://github.com/sportsdataverse/sdvplot-js/stargazers)

## **Our Authors**

- [Saiem Gilani](https://x.com/saiemgilani)
  <a href="https://x.com/saiemgilani" target="blank"><img src="https://img.shields.io/twitter/follow/saiemgilani?color=blue&label=%40saiemgilani&logo=x&style=for-the-badge" alt="@saiemgilani" /></a>
  <a href="https://github.com/saiemgilani" target="blank"><img src="https://img.shields.io/github/followers/saiemgilani?color=eee&logo=Github&style=for-the-badge" alt="@saiemgilani" /></a>

## **Citations**

To cite [**`@sportsdataverse/sdvplot`**](https://plot.sportsdataverse.org) in publications, cite sdvplot-js:

BibTex Citation

```bibtex
@misc{gilani_2026_sdvplot_js,
  author = {Gilani, Saiem},
  title = {sdvplot-js: Team identity, colors, logos, surfaces and tables for JavaScript and TypeScript plots},
  url = {https://plot.sportsdataverse.org},
  year = {2026}
}
```

## **License**

MIT. See [NOTICE.md](https://github.com/sportsdataverse/sdvplot-js/blob/main/packages/sdvplot/NOTICE.md) for the sdvplot/sdvplotR, nflverse and d3 material.
