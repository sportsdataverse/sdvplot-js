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

// stats.nba.com shots: columns x_legacy/y_legacy (the frame's defaults), tenths of a foot from the hoop.
// Every shot lands on the -x half, so draw the defensive half only: displayRange "defense".
const rawShots = [
  { x_legacy: 10, y_legacy: 120, team: "LAL", made: true },
  { x_legacy: -50, y_legacy: 230, team: "BOS", made: false },
];
const shots = toSurfaceFrame(rawShots, { from: "nba-legacy" });
const court = surface("nba", { team: "LAL", displayRange: "defense" });
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

## Subpaths

| Import | Contents |
| --- | --- |
| `@sportsdataverse/sdvplot` | `resolve`, `suggest`, `teams`, `rowsFrom`, `palette`, `teamColors`, `logoUrl`, `marks` (`full: true` fetches the whole manifest lazily), `selectMark`, `selectMarkSync`, `place`, `placeSync`, `prepareTiers`, `headshotUrl`, `loadGsis`, contrast helpers (`hex6`, `luminance`, `contrast`, `onColor`, `mix`, `solid`), `versions`, errors, types |
| `@sportsdataverse/sdvplot/react` | `TeamLogo`, `Wordmark`, `Headshot`, `useTeamColors`, `useResolve` (React >= 18, optional peer) |
| `@sportsdataverse/sdvplot/plot` | Observable Plot marks and scales: `logos`, `wordmarks`, `headshots`, `axisLogos`, `teamColor`/`teamFill`, `meanLines`/`medianLines`, `titleImage`, `teamTiers`, `surface` (optional peers `@observablehq/plot`, `@sportsdataverse/sporty`) |
| `@sportsdataverse/sdvplot/d3` | `appendLogos`, `appendWordmarks`, `appendHeadshots`, `teamColorScale`, `appendSurface` (optional peers `d3`, `@sportsdataverse/sporty`) |
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
const rows = [
  { epa: 0.21, sr: 0.48, team: "KC" },
  { epa: 0.12, sr: 0.45, team: "BUF" },
];
// TypeScript: type the figure as plotly.js's own and the same type comes back for Plotly.newPlot (JS needs no type)
const base: { data: Plotly.Data[]; layout: Partial<Plotly.Layout> } = {
  data: [{ type: "scatter", mode: "markers", x: rows.map((r) => r.epa), y: rows.map((r) => r.sr) }],
  layout: {},
};
const fig = withLogos(base, rows, { x: "epa", y: "sr", team: "team", league: "nfl", height: 0.12 });
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
