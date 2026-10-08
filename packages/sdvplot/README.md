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
build you already load. Rows are `Row[]`; `x`, `y`, `team` name columns.

```ts
import { preloadAll } from "@sportsdataverse/sdvplot";
import { withLogos, withAxisLogos, teamColorway } from "@sportsdataverse/sdvplot/plotly";
await preloadAll();
const fig = withLogos({ data: [{ type: "scatter", x, y }], layout: {} }, rows, { x: "epa", y: "sr", team: "team", league: "nfl", height: 0.12 });
Plotly.newPlot(el, fig.data, fig.layout);
```

TypeScript: pass the library's own type (`{ data: Plotly.Data[]; layout: Partial<Plotly.Layout> }`, vega-lite's `TopLevelSpec`,
echarts' `EChartsOption`) and the same type comes back.

- Plotly: `height` is a fraction of the plot area; sdvplot PINS the axis ranges (with half a logo of room) because a
  data-placed layout image is sized in axis units. Set `layout.xaxis.range` yourself to keep your own range.
  `withAxisLogos` sizes in pixels from `layout.width`/`layout.height` (Plotly's 700 × 450 default when unset).
- Vega-Lite: a native `image` layer sized from the chart height (default 300 px; a discrete y axis needs `height`).
  A discrete `sort` Vega-Lite would drop raises — use `sort: [...]`. The shorthand `"-y"` works where Vega-Lite keeps
  it; on a bar or area chart it sums the stacked measure, which Vega-Lite drops, so it raises too.
  `withAxisLogos` assumes the default axis orient (x at the bottom, y on the left).
- ECharts: a `custom` series whose `renderItem` draws in data coordinates (follows zoom/resize; no instance needed).
  `withAxisLogos` sizes from `chartHeight` (default 400 px) because an option has no canvas size. The helper series
  have no `name`, so a default `legend: {}` lists only your series.
- `embed`: `await embedSources(urls)` (exported by each of the three subpaths) → pass the map to inline data URIs (offline HTML, static export).

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
