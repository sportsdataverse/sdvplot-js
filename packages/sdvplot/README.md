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
| `@sportsdataverse/sdvplot/chartjs` | Chart.js 4: `logoPoints`, `wordmarkPoints`, `headshotPoints`, `pointImages`, `axisLogos`, `logoWatermarks`, `teamColor`/`teamFill` (optional peer `chart.js` >= 4.4) |
| `@sportsdataverse/sdvplot/testing` | Adapter-contract suite for renderer adapters: `checkAdapterContract`, `drawnMarks`, `drawnAxisMarks`, `visibleAxisLabels` |

## Chart.js (Astro, Svelte, React, plain scripts)

`@sportsdataverse/sdvplot/chartjs` returns Chart.js 4 dataset options and plugin objects, so no framework needs a
wrapper. Load the league first, and build point styles and plugins in the browser (they create `<img>`/`<canvas>`).

An Astro page with a Svelte 5 island (Game on Paper's stack):

```astro
---
// src/pages/teams.astro
import TeamScatter from "../components/TeamScatter.svelte";
const rows = await getTeamRows(); // [{ team: "UGA", epa: 0.21, sr: 0.48 }, …]
---
<TeamScatter client:only="svelte" rows={rows} />
```

```svelte
<!-- src/components/TeamScatter.svelte -->
<script lang="ts">
  import Chart from "chart.js/auto";
  import { loadLeague } from "@sportsdataverse/sdvplot";
  import { logoPoints, pointImages } from "@sportsdataverse/sdvplot/chartjs";

  let { rows }: { rows: { team: string; epa: number; sr: number }[] } = $props();
  let canvas: HTMLCanvasElement;

  $effect(() => { // runs in the browser only, never during SSR
    let chart: Chart | undefined;
    let live = true;
    loadLeague("cfb").then(() => {
      if (!live) return;
      chart = new Chart(canvas, {
        type: "scatter",
        data: { datasets: [{ data: rows.map((r) => ({ x: r.epa, y: r.sr })), ...logoPoints(rows.map((r) => r.team), { league: "cfb", radius: 14 }) }] },
        plugins: [pointImages],
      });
    });
    return () => { live = false; chart?.destroy(); };
  });
</script>

<canvas bind:this={canvas}></canvas>
```

An expected-points line per team with its logo at the line's end (Game on Paper's EP chart, team colours from sdvplot):

```ts
// TODO(Task 15): matchupColors — a contrast-checked pair for the two teams on each theme; explicit team colours for now
new Chart(canvas, {
  type: "scatter",
  data: {
    datasets: Object.entries(series).map(([team, pts]) => ({ // series: { KC: [{ x, y }, …], BUF: […] }
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
// TODO(Task 15): matchupColors — the two-team pair; explicit team colours for now
const pct = { UGA: [91, 80, 67], ALA: [85, 88, 54] };
const data = {
  labels: ["EPA/Play", "Success %", "Explosive %"],
  datasets: Object.entries(pct).map(([team, values]) => ({
    label: team,
    data: values,
    fill: true,
    backgroundColor: teamFill(team, "cfb"), // rgba(r, g, b, 0.2)
    borderColor: teamColor(team, "cfb"),
    pointBackgroundColor: teamColor(team, "cfb"),
    pointBorderColor: "#fff", // radar.ts:70-80 rings each point in white
    pointHoverBackgroundColor: "#fff",
    pointHoverBorderColor: teamColor(team, "cfb"),
  })),
};
```

Faint team logos behind a line (Game on Paper's win-probability chart): the first team top-left of the chart area, the
last bottom-left, at 0.4 opacity and 75 px tall by default:

```ts
import { logoWatermarks, teamColor } from "@sportsdataverse/sdvplot/chartjs";
const dark = matchMedia("(prefers-color-scheme: dark)").matches;
// TODO(Task 15): matchupColors — the home/away pair; explicit team colours for now
new Chart(canvas, {
  type: "line",
  data: { labels: seconds, datasets: [{ data: homeWp, borderColor: teamColor("UGA", "cfb"), pointRadius: 0 }] },
  plugins: [logoWatermarks(["UGA", "ALA"], { league: "cfb", variant: dark ? "dark" : "default" })],
});
```

Logos on a category axis:

```ts
new Chart(canvas, {
  type: "bar",
  data: { labels: ["KC", "BUF", "BAL"], datasets: [{ data: [0.21, 0.18, 0.15], backgroundColor: teamColor(["KC", "BUF", "BAL"], "nfl") }] },
  plugins: [axisLogos("x", { league: "nfl", size: 28 })],
});
```

- Sizes are pixels: `radius` (point styles), `size` (axis logos, watermarks) — Chart.js draws an image at its own size.
- Add `pointImages` to `plugins` with any `*Points`: Chart.js does not redraw when an `<img>` finishes loading.
- An unknown team draws its own label as text (or pass `fallback: "circle"`), with one warning per call.
- Dark theme: `variant: "dark"` (read `prefers-color-scheme` as Game on Paper does); a team with no dark mark falls back to a light one by polarity, so no `onerror` retry is needed.
- Two teams on one chart: `teamColor(team, league, { which: "secondary" })` is the alternate; a contrast-checked pair per theme is `matchupColors` (Task 15, pending).
- `axisLogos` needs a category axis; unresolved labels keep their text; your own scale options are not modified, and replacing `chart.options` (`chart.options = next; chart.update()`) keeps the logos.

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
