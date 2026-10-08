# **sdvplot-js** <a href='https://plot.sportsdataverse.org/'><img src='https://raw.githubusercontent.com/sportsdataverse/sdvplot-js/main/docs/static/img/sdvplot-js-logo.png' align="right" width="25%" min-width="120px" alt="sdvplot-js hex logo" /></a>

<!-- badges: start -->

[![sdvplot](https://img.shields.io/npm/v/@sportsdataverse/sdvplot?label=sdvplot&logo=npm&style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sdvplot)
[![sporty](https://img.shields.io/npm/v/@sportsdataverse/sporty?label=sporty&logo=npm&style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sporty)
[![sdvtables](https://img.shields.io/npm/v/@sportsdataverse/sdvtables?label=sdvtables&logo=npm&style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sdvtables)
[![Node](https://img.shields.io/node/v/@sportsdataverse/sdvplot?logo=nodedotjs&logoColor=white&style=for-the-badge)](https://nodejs.org/)
[![ci](https://img.shields.io/github/actions/workflow/status/sportsdataverse/sdvplot-js/ci.yml?branch=main&label=ci&logo=github&style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/actions/workflow/status/sportsdataverse/sdvplot-js/release.yml?branch=main&label=release&logo=github&style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/actions/workflows/release.yml)
[![docs](https://img.shields.io/github/deployments/sportsdataverse/sdvplot-js/Production?label=docs&logo=vercel&style=for-the-badge)](https://plot.sportsdataverse.org)
[![Lifecycle: experimental](https://img.shields.io/badge/lifecycle-experimental-orange.svg?style=for-the-badge&logo=github)](https://lifecycle.r-lib.org/articles/stages.html#experimental)
[![License](https://img.shields.io/github/license/sportsdataverse/sdvplot-js?style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/blob/main/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/sportsdataverse/sdvplot-js?style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/graphs/contributors)
[![Twitter Follow](https://img.shields.io/twitter/follow/SportsDataverse?color=blue&label=%40SportsDataverse&logo=x&style=for-the-badge)](https://x.com/SportsDataverse)

<!-- badges: end -->

Team identity, colors, logos, wordmarks, headshots, playing surfaces and publication tables for JavaScript and
TypeScript plots, from the SportsDataverse. sdvplot-js resolves team abbreviations, names and provider ids across 28
leagues and picks the right era's mark for a season; draws courts, rinks and fields for nine sports; and renders
themed tables with team logos. The marks work with Observable Plot, d3, React, Chart.js, Plotly, Vega-Lite and
ECharts. These are the TypeScript ports of [sdvplot](https://sdvplot.sportsdataverse.org/) (Python),
[sdvplotR](https://sdvplotR.sportsdataverse.org/) and [sportyR](https://github.com/sportsdataverse/sportyR) /
[sportypy](https://sportypy.sportsdataverse.org/).

| Package | Downloads | Contents |
| --- | --- | --- |
| [**`@sportsdataverse/sdvplot`**](packages/sdvplot/README.md) | [![sdvplot monthly downloads](https://img.shields.io/npm/dm/@sportsdataverse/sdvplot?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sdvplot) [![sdvplot total downloads](https://img.shields.io/npm/dt/@sportsdataverse/sdvplot?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sdvplot) | Team identity, colors, logos, wordmarks and headshots; marks for Observable Plot, d3, React, Chart.js, Plotly, Vega-Lite and ECharts; shot charts; linked interactivity; PNG export |
| [**`@sportsdataverse/sporty`**](packages/sporty/README.md) | [![sporty monthly downloads](https://img.shields.io/npm/dm/@sportsdataverse/sporty?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sporty) [![sporty total downloads](https://img.shields.io/npm/dt/@sportsdataverse/sporty?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sporty) | Playing surfaces (courts, rinks, fields) as plain geometry, rendered to SVG, canvas, Observable Plot or d3; coordinate frames for source data |
| [**`@sportsdataverse/sdvtables`**](packages/sdvtables/README.md) | [![sdvtables monthly downloads](https://img.shields.io/npm/dm/@sportsdataverse/sdvtables?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sdvtables) [![sdvtables total downloads](https://img.shields.io/npm/dt/@sportsdataverse/sdvtables?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sdvtables) | Publication tables: a serializable `TableSpec` rendered to static or interactive HTML and to PNG, with team logos, headshots, colors and themes |

## **Installation**

Install the packages you use; the examples under [Usage](#usage) use all three:

```bash
npm install @sportsdataverse/sdvplot @sportsdataverse/sporty @sportsdataverse/sdvtables
# or
pnpm add @sportsdataverse/sdvplot @sportsdataverse/sporty @sportsdataverse/sdvtables
# or
yarn add @sportsdataverse/sdvplot @sportsdataverse/sporty @sportsdataverse/sdvtables
```

All three packages are ESM only and need Node >= 20.18.1. The sdvplot and sporty cores need no other package;
sdvtables needs sdvplot. The subpaths that draw on a library take it as an optional peer, which npm and pnpm do not
install for you, so add the ones for the subpaths you import:

| You import | Also install |
| --- | --- |
| `@sportsdataverse/sdvplot`, `/bins`, `/testing`, `/plotly`, `/vega`, `/echarts` | nothing |
| `@sportsdataverse/sdvplot/plot` | `@observablehq/plot` >= 0.6.16 and `@sportsdataverse/sporty` |
| `@sportsdataverse/sdvplot/d3` | `d3` >= 7 and `@sportsdataverse/sporty` |
| `@sportsdataverse/sdvplot/shots` | `@sportsdataverse/sporty` |
| `@sportsdataverse/sdvplot/chartjs` | `chart.js` >= 4.4 |
| `@sportsdataverse/sdvplot/chartjs/surface` | `chart.js` >= 4.4 and `@sportsdataverse/sporty` |
| `@sportsdataverse/sdvplot/interact` | `d3` >= 7 |
| `@sportsdataverse/sdvplot/react` | `react` >= 18 |
| `@sportsdataverse/sdvplot/export` | `@resvg/resvg-js` (for `toPNG`) |
| `@sportsdataverse/sporty`, `/svg`, `/specs`, `/canvas` | nothing (`@napi-rs/canvas` >= 0.1.50 gives `/canvas` a 2D context in Node) |
| `@sportsdataverse/sporty/plot` | `@observablehq/plot` >= 0.6.16 |
| `@sportsdataverse/sporty/d3` | `d3` >= 7 |
| `@sportsdataverse/sdvtables`, `/html` | `@sportsdataverse/sdvplot` (a required peer; npm 7+ and pnpm install it for you) |
| `@sportsdataverse/sdvtables/react` | `react` >= 18 |
| `@sportsdataverse/sdvtables/export` | `playwright` >= 1.45 |

`/plot`, `/d3`, `/shots` and `/chartjs/surface` need `@sportsdataverse/sporty` whether or not you draw a surface:
they import it when they load, and fail to load without it. No other subpath imports sporty. For an Observable Plot
chart:

```bash
npm install @sportsdataverse/sdvplot @sportsdataverse/sporty @observablehq/plot
```

## **Usage**

Team identity, colors and marks:

```ts
import { logoUrl, palette, resolve } from "@sportsdataverse/sdvplot";

await resolve(["LV", "OAK", "Las Vegas Raiders"], "nfl"); // ["13", "13", "13"]
await palette("nfl", ["LV", "KC"]); // { LV: "#000000", KC: "#e31837" }
await logoUrl("OAK", "nfl", { season: 2010 }); // the mark the Raiders used in 2010, a CDN URL
```

A court as an SVG file:

```ts
import { writeFileSync } from "node:fs";
import { basketballCourt } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";

writeFileSync("nba.svg", toSVG(basketballCourt("nba")));
```

A table with team logos, here the 2024 AFC West:

```ts
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";

const spec = defineTable<{ team: string; wins: number }>()
  .columns((c) => [c.logo("team", { league: "nfl", includeName: true }), c.int("wins")])
  .theme("midnight")
  .title("AFC West")
  .build();
const rows = [
  { team: "KC", wins: 15 },
  { team: "LAC", wins: 11 },
  { team: "DEN", wins: 10 },
  { team: "LV", wins: 4 },
];
const html = await renderHTMLAsync(spec, rows); // an HTML string for Node, SSR or the browser
```

Each package's README has more: a shot chart on a court with Observable Plot in
[`@sportsdataverse/sdvplot`](packages/sdvplot/README.md#quick-start), canvas and d3 surfaces in
[`@sportsdataverse/sporty`](packages/sporty/README.md#quick-start), and interactive tables in
[`@sportsdataverse/sdvtables`](packages/sdvtables/README.md#interactive).

## **Documentation**

The [**sdvplot-js** documentation website](https://plot.sportsdataverse.org) has the
[introduction](https://plot.sportsdataverse.org/), the [gallery](https://plot.sportsdataverse.org/gallery/), the
[notebooks](https://plot.sportsdataverse.org/notebooks/) and the API reference for
[sdvplot](https://plot.sportsdataverse.org/api/sdvplot/), [sporty](https://plot.sportsdataverse.org/api/sporty/) and
[sdvtables](https://plot.sportsdataverse.org/api/sdvtables/), plus:

**Guides:**
[Identity and resolution](https://plot.sportsdataverse.org/guides/identity) ·
[Team colours](https://plot.sportsdataverse.org/guides/colors) ·
[Logos, wordmarks, headshots](https://plot.sportsdataverse.org/guides/marks) ·
[Observable Plot](https://plot.sportsdataverse.org/guides/observable-plot) ·
[D3](https://plot.sportsdataverse.org/guides/d3) ·
[React](https://plot.sportsdataverse.org/guides/react) ·
[Plotly, Vega-Lite, ECharts and Chart.js](https://plot.sportsdataverse.org/guides/chart-libraries) ·
[Shot charts](https://plot.sportsdataverse.org/guides/shot-charts) ·
[Playing surfaces](https://plot.sportsdataverse.org/guides/surfaces) ·
[Node and SSR](https://plot.sportsdataverse.org/guides/node-ssr) ·
[Export to PNG](https://plot.sportsdataverse.org/guides/export)

**Tables:**
[The spec](https://plot.sportsdataverse.org/guides/tables) ·
[Table themes](https://plot.sportsdataverse.org/guides/table-themes) ·
[Cell kinds](https://plot.sportsdataverse.org/guides/cell-kinds) ·
[Decorations](https://plot.sportsdataverse.org/guides/decorations) ·
[HTML, SSR and the host page](https://plot.sportsdataverse.org/guides/tables-html)

**Examples:**
[Basketball](https://plot.sportsdataverse.org/examples/basketball) ·
[Football](https://plot.sportsdataverse.org/examples/football) ·
[Hockey](https://plot.sportsdataverse.org/examples/hockey) ·
[Linked figures and tables](https://plot.sportsdataverse.org/examples/linked) ·
[A linked shot dashboard](https://plot.sportsdataverse.org/examples/shot-dashboard) ·
[Sample data](https://plot.sportsdataverse.org/sample-data)

**Coming from elsewhere:**
[sdvplot (Python), sdvplotR and sportyR](https://plot.sportsdataverse.org/guides/migrating) ·
[Game on Paper (Chart.js + Astro/Svelte)](https://plot.sportsdataverse.org/guides/game-on-paper) ·
[blazing-the-nets (Next/React + d3)](https://plot.sportsdataverse.org/guides/blazing-the-nets)

## **Development**

### Repository layout

- `packages/` - the three packages, each with its tests and public-API report (`etc/*.api.md`)
- `examples/` - every example the docs site shows, one module each; `pnpm test` runs them all
- `docs/` - the Docusaurus site: guides, the gallery and the typedoc API reference
- `notebooks/` - Observable Framework notebooks, built into the site at `/notebooks/`; a standalone npm app (the
  docs build runs `npm ci` there whenever its lockfile changes)
- `tools/` - the league-data index build, vendoring, codegen, parity oracles and brand assets
- `fixtures/` - real captured data the tests and examples read

### Toolchain

pnpm workspace, tsup, vitest, biome, api-extractor (public-type drift baseline in `packages/*/etc`),
attw + publint, changesets.

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm api:check && pnpm pack:check
```

After changing public types run `pnpm -r api:report` and commit the updated `etc/*.api.md`.

### Docs build

Every example on the site runs in CI. `pnpm docs:build` first runs the examples gate: each example is executed
offline in Node (jsdom for the DOM), and one that throws, renders nothing, draws `NaN` or warns unexpectedly fails the
build. The same run writes the markup the pages serve, so nothing generated is committed. The build then adds the
notebooks and the Docusaurus site, and `check-build` confirms each inline output on a gallery page is the gate's.
CI also typechecks the site (`pnpm --filter docs typecheck`).

The Vercel build is pinned by `vercel.json` (install `pnpm install --frozen-lockfile`, build `pnpm docs:build`, output
`docs/build`), so the gate, the gallery and the notebooks run on every deploy. Vercel reads that file only when the
project's Root Directory is the repository root.

`pnpm --filter docs start` (the dev server) prerenders the examples but does not build the notebooks, so `/notebooks/`
is a 404 there. To preview the whole site, notebooks included, build it and serve the output:

```bash
pnpm docs:build && pnpm --filter docs serve
```

The site ships unminified HTML: `docs/build.env` sets `SKIP_HTML_MINIFICATION=true` for every build. Docusaurus' swc
minifier drops optional end tags, reorders CSS declarations and merges `<style>` elements in the inline outputs, so
`check-build` could not compare them, and it saved only 1.6% of the HTML over brotli. The same setting lets the build
run on Windows, where the minifier's native addon fails to load. On Windows, keep the checkout path short: under a deep
path `@napi-rs/canvas` cannot find its ICU data and aborts, which kills the examples gate's worker (the gate then
fails, counting the examples that never ran).

### Owner steps

- Publishing to npm: follow [RELEASING.md](RELEASING.md) (first publish, then trusted publishing).
- Upload `docs/static/img/social-card.png` as the repo's Social preview (Settings → General); GitHub has no
  API for it. `pnpm brand` regenerates it and the other brand assets (see `tools/brand/README.md`).

## **Logos, trademarks and data**

Team names, logos, wordmarks and player headshots are trademarks or copyrighted works of their respective leagues,
teams, schools and other rights holders. sdvplot-js is not affiliated with, sponsored by or endorsed by any of them,
and using sdvplot-js to draw a mark grants no right to use it. The packages ship no logo or headshot files:
`@sportsdataverse/sdvplot` carries an index of team names, ids and colors and the addresses of the archived marks, and
the marks are fetched at runtime from the [SportsDataverse logo archive](https://github.com/sportsdataverse/sdv-assets),
headshots from ESPN (or, for NFL gsis ids, the headshot URLs in nflverse's player table). Use of any mark in your own
work is governed by that owner's terms, and following them is your responsibility.

The NFL team colors and the gsis-id headshot map come from [nflverse-data](https://github.com/nflverse/nflverse-data)
by the nflverse project, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The surface geometry and
dimensions in `@sportsdataverse/sporty` are ported from [sportyR](https://github.com/sportsdataverse/sportyR) (Ross
Drucker) and [sportypy](https://sportypy.sportsdataverse.org/). The [MIT license](LICENSE) covers the sdvplot-js code;
team data belongs to its respective owners and sources. [NOTICE.md](NOTICE.md) records each third-party source and its
licence.

## **The SportsDataverse**

sdvplot-js draws the pictures; the companion packages fetch the data.

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

To cite [**sdvplot-js**](https://plot.sportsdataverse.org) in publications, use:

BibTeX Citation

```bibtex
@misc{gilani_2026_sdvplot_js,
  author = {Gilani, Saiem},
  title = {sdvplot-js: Team identity, colors, logos, surfaces and tables for JavaScript and TypeScript plots},
  url = {https://plot.sportsdataverse.org},
  year = {2026}
}
```

[CITATION.cff](CITATION.cff) carries the same entry for GitHub's "Cite this repository".

## **License**

MIT. See [NOTICE.md](NOTICE.md) for the ported and third-party material and its licences.
