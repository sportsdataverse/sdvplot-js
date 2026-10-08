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
| `@sportsdataverse/sdvplot/plot` | Observable Plot marks and scales: `logos`, `wordmarks`, `headshots`, `axisLogos`, `teamColor`/`teamFill`, `meanLines`/`medianLines`, `titleImage`, `teamTiers`, `surface` (optional peers `@observablehq/plot`, `@sportsdataverse/sporty`) |
| `@sportsdataverse/sdvplot/d3` | `appendLogos`, `appendWordmarks`, `appendHeadshots`, `teamColorScale`, `appendSurface` (optional peers `d3`, `@sportsdataverse/sporty`) |
| `@sportsdataverse/sdvplot/testing` | Adapter-contract suite for renderer adapters: `checkAdapterContract`, `drawnMarks`, `drawnAxisMarks`, `visibleAxisLabels` |

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
