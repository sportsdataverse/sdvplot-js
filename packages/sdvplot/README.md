# @sportsdataverse/sdvplot

Team identity, colors, logos, wordmarks and headshots for SportsDataverse plots. TypeScript port of the Python `sdvplot` package (and `sdvplotR`).

## Quick start

```ts
import { resolve, palette, logoUrl } from "@sportsdataverse/sdvplot";

const id = await resolve("KC", "nfl", { season: 2023 }); // canonical TeamId
const colors = await palette("KC", "nfl"); // team colors
const url = await logoUrl("KC", "nfl"); // CDN logo URL
// React: import { TeamLogo } from "@sportsdataverse/sdvplot/react"; <TeamLogo team="KC" league="nfl" size={32} />
```

`resolveSync`, `teamColorsSync` and `logoUrlSync` are available once `loadLeague(league)` (or `preloadAll()`) has run.

## Subpaths

| Import | Contents |
| --- | --- |
| `@sportsdataverse/sdvplot` | `resolve`, `suggest`, `teams`, `palette`, `teamColors`, `logoUrl`, `marks`, `selectMark`, `headshotUrl`, contrast helpers (`hex6`, `luminance`, `contrast`, `onColor`, `mix`, `solid`), `versions`, errors, types |
| `@sportsdataverse/sdvplot/react` | `TeamLogo`, `Wordmark`, `Headshot`, `useTeamColors` (React >= 18, optional peer) |

## Data provenance

The identity data is curated in the Python `sdvplot` repo. This package ships it as generated per-league `.ts` shards (`src/data/**`, never hand-edited) plus a best-marks slice of the CDN manifest. Regenerate with:

```sh
SDVPLOT_PY_REPO=/path/to/sdvplot pnpm build:index
```

Parity is enforced by the Python oracle (`pnpm oracle:sdvplot`): the test suite replays 25,265 cases over 8,403 real inputs against the Python package and requires 100% agreement.

## Owner steps (before the first publish)

1. Create the `sportsdataverse` organization on npm.
2. Enable OIDC trusted publishing for `@sportsdataverse/sdvplot` (repository `sportsdataverse/sdvplot-js`, release workflow).

## License

MIT
