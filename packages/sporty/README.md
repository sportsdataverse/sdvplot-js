# **@sportsdataverse/sporty** <a href='https://plot.sportsdataverse.org/'><img src='https://raw.githubusercontent.com/sportsdataverse/sdvplot-js/main/docs/static/img/sdvplot-js-logo.png' align="right" width="25%" min-width="120px" alt="sdvplot-js hex logo" /></a>

<!-- badges: start -->

[![npm](https://img.shields.io/npm/v/@sportsdataverse/sporty?label=sporty&logo=npm&style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sporty)
[![Downloads](https://img.shields.io/npm/dm/@sportsdataverse/sporty?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sporty)
[![Total downloads](https://img.shields.io/npm/dt/@sportsdataverse/sporty?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sporty)
[![Node](https://img.shields.io/node/v/@sportsdataverse/sporty?logo=nodedotjs&logoColor=white&style=for-the-badge)](https://nodejs.org/)
[![Unpacked size](https://img.shields.io/npm/unpacked-size/@sportsdataverse/sporty?style=for-the-badge)](https://www.npmjs.com/package/@sportsdataverse/sporty?activeTab=code)
[![ci](https://img.shields.io/github/actions/workflow/status/sportsdataverse/sdvplot-js/ci.yml?branch=main&label=ci&logo=github&style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/actions/workflow/status/sportsdataverse/sdvplot-js/release.yml?branch=main&label=release&logo=github&style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/actions/workflows/release.yml)
[![docs](https://img.shields.io/github/deployments/sportsdataverse/sdvplot-js/Production?label=docs&logo=vercel&style=for-the-badge)](https://plot.sportsdataverse.org)
[![Lifecycle: experimental](https://img.shields.io/badge/lifecycle-experimental-orange.svg?style=for-the-badge&logo=github)](https://lifecycle.r-lib.org/articles/stages.html#experimental)
[![License](https://img.shields.io/github/license/sportsdataverse/sdvplot-js?style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/blob/main/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/sportsdataverse/sdvplot-js?style=for-the-badge)](https://github.com/sportsdataverse/sdvplot-js/graphs/contributors)
[![Twitter Follow](https://img.shields.io/twitter/follow/SportsDataverse?color=blue&label=%40SportsDataverse&logo=x&style=for-the-badge)](https://x.com/SportsDataverse)

<!-- badges: end -->

Sport surfaces (courts, rinks, fields) as plain geometry for SportsDataverse plots. TypeScript port of the R package [sportyR](https://github.com/sportsdataverse/sportyR) 2.2.3: every surface is a `Scene` of polygons and text, rendered by the `svg`, `canvas`, `plot` and `d3` subpaths.

Part of [sdvplot-js](https://github.com/sportsdataverse/sdvplot-js#readme) · [Documentation](https://plot.sportsdataverse.org) · [API reference](https://plot.sportsdataverse.org/api/sporty/) ·
[Gallery](https://plot.sportsdataverse.org/gallery/sporty/) · [Notebooks](https://plot.sportsdataverse.org/notebooks/) · [Source](https://github.com/sportsdataverse/sdvplot-js/tree/main/packages/sporty)

## **Installation**

```sh
npm install @sportsdataverse/sporty
# or
pnpm add @sportsdataverse/sporty
# or
yarn add @sportsdataverse/sporty
```

ESM only, Node >= 20.18.1. The core, `svg`, `specs` and `canvas` subpaths need nothing else. Optional peers, installed
only for the subpath you import: `@observablehq/plot` >= 0.6.16 for `/plot`, `d3` >= 7 for `/d3`, and
`@napi-rs/canvas` >= 0.1.50 to give `/canvas` a 2D context in Node (browsers have their own).

## **Quick start**

```ts
import { writeFileSync } from "node:fs";
import { basketballCourt, toSurfaceFrame } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";

writeFileSync("nba.svg", toSVG(basketballCourt("nba")));

// Move source data into the surface frame (feet, surface origin), then plot it over the SVG. This shot is LeBron
// James's made three at Denver, 2023-10-24 (stats.nba.com shotchartdetail, game 0022300061, event 510).
const shots = toSurfaceFrame([{ x_legacy: -53, y_legacy: 285 }], { from: "nba-legacy" });
// [{ x_legacy: -53, y_legacy: 285, surface_x: -13.25, surface_y: -5.3 }] -> plot (surface_x, surface_y) in feet
```

Draw a surface with Observable Plot or d3 (optional peers):

```js
import * as Plot from "@observablehq/plot";
import { basketballCourt } from "@sportsdataverse/sporty";
import { surfaceMark, surfaceScales } from "@sportsdataverse/sporty/plot";

const scene = basketballCourt("nba");
Plot.plot({ ...surfaceScales(scene), marks: surfaceMark(scene) });

// d3: appendSurface(selection, scene, x, y) draws the same Scene through your scale functions.
import { appendSurface } from "@sportsdataverse/sporty/d3";
```

`surfaceMark(scene, { ariaDescription })`, `toSVG(scene, { ariaDescription })` and
`appendSurface(selection, scene, x, y, { ariaDescription })` describe the surface for assistive technology, on the group
that holds it; the default is the scene's league and sport, such as "nba basketball surface". A canvas has no DOM to
carry one: describe the `<canvas>` element itself.

Paint onto a canvas (a browser `CanvasRenderingContext2D`, or `@napi-rs/canvas` in Node; no DOM types needed):

```ts
import { drawScene } from "@sportsdataverse/sporty/canvas";

const { width, height } = drawScene(ctx, basketballCourt("nba"), { width: 800 }); // or { width, height } to fit a box, or { scale: 8 } px per unit
```

`toSVG(scene, { arcs: "svg" })` replaces each detected circle run with SVG `A` commands, one per quarter turn (`ceil(span / 90°)` per run, so a full circle is four), instead of emitting every sampled point as `L`; the default `"sampled"` keeps the Scene's points verbatim. Under `arcs: "svg"`, `arcResolution` no longer affects how circles look (it still sets how many points the Scene carries).

`surface(sport, league, opts)` dispatches by sport; `leagues`, `features`, `displayRanges` and `colorKeys` list what each sport accepts. Options mirror sportyR: `updates` (parameter overrides), `colorUpdates`, `rotation`, `xTrans`, `yTrans`, `units` (`ft`, `m`, `yd`, `in`, `cm`, `mm`, any case, or a full name such as `"feet"`; anything else throws `UnknownUnitError`), `displayRange`, `xlim`, `ylim`, `arcResolution` (points per arc, an integer >= 2, default 200). Options are typed per sport, so a misspelled option or key is a compile error.

## **Subpaths**

| Import | Contents |
| --- | --- |
| `@sportsdataverse/sporty` | `surface`, `SPORTS`, `basketballCourt`, `hockeyRink`, `footballField`, `soccerPitch`, `baseballField`, `tennisCourt`, `volleyballCourt`, `curlingSheet`, `lacrosseField`, `Scene`, `toSurfaceFrame`, `FRAMES`, `basketballZoneOf`, `basketballZones`, `BASKETBALL_ZONES`, `BASKETBALL_ZONE_LABELS`, errors |
| `@sportsdataverse/sporty/svg` | `toSVG` (`width`, `height`, `background`, `precision`, `id`, `arcs: "sampled" \| "svg"`) |
| `@sportsdataverse/sporty/specs` | generated parameter specs for all sports |
| `@sportsdataverse/sporty/plot` | `surfaceMark`, `surfaceScales`, `sceneToGeoJSON` (optional peer `@observablehq/plot`) |
| `@sportsdataverse/sporty/canvas` | `drawScene`, `SceneCanvasContext` (DOM-free; takes a browser 2D context or an `@napi-rs/canvas` one in Node) |
| `@sportsdataverse/sporty/d3` | `appendSurface` (optional peer `d3`) |

## **Ported sports**

| Sport | Builder | Leagues | Notes |
| --- | --- | --- | --- |
| basketball | `basketballCourt` | `custom`, `fiba`, `nba`, `nba g league`, `ncaa`, `nfhs`, `wnba` | |
| hockey | `hockeyRink` | `ahl`, `custom`, `echl`, `iihf`, `ncaa`, `nhl`, `nwhl`, `ohl`, `phf`, `pwhl`, `qmjhl`, `ushl` | |
| football | `footballField` | `cfl`, `custom`, `ncaa`, `nfhs11`, `nfhs6`, `nfhs8`, `nfhs9`, `nfl` | |
| soccer | `soccerPitch` | `custom`, `epl`, `fifa`, `mls`, `ncaa`, `nwsl` | Native units `m` (epl, fifa) or `yd` (mls, ncaa, nwsl) |
| baseball | `baseballField` | `custom`, `little league`, `milb`, `mlb`, `ncaa`, `nfhs`, `pony` | `origin: "home_plate"`: the back tip of home plate, +y toward centre field, +x toward first base; `ft` |
| tennis | `tennisCourt` | `atp`, `custom`, `ita`, `itf`, `ncaa`, `usta`, `wta` | Chair-umpire view: the net runs along y at x = 0; `ft` |
| volleyball | `volleyballCourt` | `custom`, `fivb`, `ncaa`, `usa volleyball` | `m` |
| curling | `curlingSheet` | `curling canada`, `custom`, `wcf` | Drawn vertically: +y toward the top house, `sheet_width` along x; `ft` |
| lacrosse | `lacrosseField` | `custom`, `ncaam`, `ncaaw`, `nll`, `pll`, `usam`, `usaw`, `world lacrosse` | Mixed native units: `yd` (ncaam, pll, usam), `m` (ncaaw, usaw), `ft` (nll, world lacrosse); pass `units` to draw them alike |

## **Coordinate frames**

`FRAMES` holds the source frames; `toSurfaceFrame(rows, { from, x?, y?, out? })` adds `surface_x`/`surface_y` (feet, surface origin; `null` for missing input). These move the data; sporty's `xTrans`/`yTrans` move the surface.

| Name | Source | Formula |
| --- | --- | --- |
| `nba-legacy` | stats.nba.com shots (tenths of a foot, hoop origin; inputs default to `x_legacy`/`y_legacy`). Shots land on the -x half: pair with `displayRange: "defense"` | `surface_x = -47 + 5.25 + y/10`, `surface_y = x/10` |
| `nba-legacy-vertical` | The same shots with the hoop at the bottom, for a `rotation: 90` scene: points come out already in the rotated frame (do not rotate them again); x across with its sign kept, y toward half court | `surface_x = x/10`, `surface_y = -47 + 5.25 + y/10` |
| `hockeytech` | HockeyTech play-by-play 600x300 canvas, top-left origin, centre ice at (300, 150), every league (fastRhockey). The canvas is stylised rather than true to scale: end-zone faceoff dots convert to about ±67 ft and ±52 ft against regulation ±69 ft, so the feet are approximate | `x/3 - 100`, `42.5 - y*85/300` |
| `espn-football-0-100` | ESPN yardline 0-100 | `x - 50`, `y` unchanged |

Basketball shot zones: `basketballZoneOf(x, y, shotValue, { league, scale })` names the stats.nba.com zone of a basket-centred shot (`BASKETBALL_ZONES`, display names in `BASKETBALL_ZONE_LABELS`), and `basketballZones(league, { scale, top })` returns the six zones as fillable rings. Both are basket-centred, not in a surface frame: map the rings through the same frame as the shots (for legacy shots on the hoop-at-the-bottom chart, `scale: 10` and `FRAMES["nba-legacy-vertical"]`).

## **Provenance and parity**

Ported from sportyR 2.2.3 - see [NOTICE.md](https://github.com/sportsdataverse/sdvplot-js/blob/main/packages/sporty/NOTICE.md) (J3). The R package is the oracle: the test suite compares every feature of all 53 non-`custom` league surfaces point for point to 1e-9 against R output stored under `fixtures/sporty`, and a league without fixtures fails. Regenerate the fixtures with `pnpm oracle:sporty basketball hockey football soccer baseball tennis volleyball curling lacrosse` (needs R and sportyR); the oracle refuses to run unless the installed sportyR's `surface_dimensions` equals the vendored `data/surface-dimensions.json`, and records that file's sha256 in `fixtures/sporty/VERSION`. Parameter specs in `src/specs` are generated from the vendored JSON (`pnpm codegen`).

Drift gates in CI: `pnpm codegen --check` (specs match the vendored JSON) and `test/fixtures-version.test.ts` (the vendored JSON's sha256 and sportyR version/checkout match the ones the fixtures were generated from). `pnpm vendor --check` compares the vendored JSON with a sportyR checkout, so it only runs where one exists (`SPORTYR_REPO`); elsewhere it skips.

## **Differences from sportyR**

- An unknown `displayRange` throws `UnknownDisplayRangeError` (R silently falls back to `"full"`).
- `units` converts the anchors and display limits too (R converts only the feature points, so non-native units plot wrongly).
- Vector colours recycle per copy of a feature (`colorAt`), as R `data.frame()` does. Curling's `house_rings` recycles too, so a single colour fills every ring; R indexes it per ring and leaves rings 2 and 3 `NA`.
- A lane space mark takes its own set's colour; R reads row `i` (the lane index) of the set instead, which is `NA` once a court has more lanes than marks per set. Default leagues are unaffected.
- An `undefined`/`null` entry in `updates` or `colorUpdates` keeps the default.
- The `custom` league builds a surface from its all-zero defaults in every sport. R builds it for baseball, curling, hockey, soccer, tennis and volleyball, and errors for basketball, football and lacrosse.
- A `custom` league with empty native units (every sport except volleyball, whose `custom` is in metres) reads them as feet, so `units` converts it. R errors with `" is not a viable unit"` for the five of those sports it can build (e.g. `geom_curling("custom", sheet_units = "m")`).
- Tennis accepts R's misspelt receiving-half keys (`receivicehalf`, `receivice_half`, `receivice half`) and the correct spellings (`receivehalf`, `receive_half`, `receive half`); R has only the misspelling and draws the full court for the correct one.
- Lacrosse: a user's `center_face_off_marker` colour wins over the contrasting `#ffcb05` default (ncaam, `custom`); R overwrites it.
- Lacrosse: the five parameters R reads but no league defines (`nzone_length`, `board_thickness`, `center_face_off_marker_radius`, `corner_face_off_marker_bar_width`, `corner_face_off_marker_bar_length`) are fixed at 0 as R draws them, and `updates` cannot set them.
- Text features carry a `fitBox` (the ggfittext box) that the SVG renderer fits by height only.

## **Performance**

Local baseline from `test/perf.test.ts` (median of 10 runs after 5 warm-ups; the test asserts build < 50 ms and `toSVG` < 20 ms and is opt-in: `SDV_PERF_TESTS=1 pnpm vitest run perf`, skipped otherwise because the budgets are absolute and shared runners are noisy — these numbers are documented, not gated). Measured 2026-10-07 on a 12th Gen Intel Core i9-12900K, Node v24.15.0:

| Operation | Median |
| --- | --- |
| `basketballCourt("nba", { arcResolution: 200 })` | 3.1 ms |
| `toSVG(scene)` | 7.6 ms |
| `toSVG(scene, { arcs: "svg" })` | 1.8 ms |

Across three runs the medians ranged 2.5–3.2 ms (build), 4.8–8.0 ms (`toSVG`) and 0.8–1.8 ms (`arcs: "svg"`).

Three test files are gated: `canvas.render.test.ts` runs wherever `@napi-rs/canvas` installs (CI included); `svg-arcs.render.test.ts` rasterizes both path variants through resvg and needs `SDV_RENDER_TESTS=1`; `perf.test.ts` needs `SDV_PERF_TESTS=1`.

## **Roadmap**

3D surfaces. The `elevation` and `height` hints a `Scene` would carry are designed in the
[3D contract](https://github.com/sportsdataverse/sdvplot-js/blob/main/docs/3d-contract.md), for a future
`@sportsdataverse/sporty-3d`; the renderers here ignore them and draw flat.

## **Documentation**

The [**sdvplot-js** documentation website](https://plot.sportsdataverse.org) has the
[sporty gallery](https://plot.sportsdataverse.org/gallery/sporty/), the [notebooks](https://plot.sportsdataverse.org/notebooks/) and the
[sporty API reference](https://plot.sportsdataverse.org/api/sporty/), one page per subpath, plus:

**Guides:**
[Playing surfaces](https://plot.sportsdataverse.org/guides/surfaces) ·
[Shot charts](https://plot.sportsdataverse.org/guides/shot-charts) ·
[D3](https://plot.sportsdataverse.org/guides/d3) ·
[Node and SSR](https://plot.sportsdataverse.org/guides/node-ssr) ·
[From sportyR](https://plot.sportsdataverse.org/guides/migrating)

**Surfaces by sport:**
[Basketball](https://plot.sportsdataverse.org/examples/basketball) ·
[Football](https://plot.sportsdataverse.org/examples/football) ·
[Hockey](https://plot.sportsdataverse.org/examples/hockey)

The [repository README](https://github.com/sportsdataverse/sdvplot-js#readme) covers all three packages and development.

## **Logos, trademarks and data**

The surface geometry and the surface-dimensions data are ported from
[sportyR](https://github.com/sportsdataverse/sportyR) 2.2.3 (Ross Drucker) and
[sportypy](https://sportypy.sportsdataverse.org/); by agreement between the SportsDataverse maintainers the ported
material is distributed here under MIT. League names identify the rule sets the dimensions follow; sporty draws no
league or team marks.

The [MIT license](https://github.com/sportsdataverse/sdvplot-js/blob/main/LICENSE) covers the code; team data belongs to its respective owners and sources.
[NOTICE.md](https://github.com/sportsdataverse/sdvplot-js/blob/main/packages/sporty/NOTICE.md) records the ported sportyR/sportypy material and its licences.

## **The SportsDataverse**

`@sportsdataverse/sporty` is one of the three [sdvplot-js](https://github.com/sportsdataverse/sdvplot-js#readme) packages, with [`@sportsdataverse/sdvplot`](https://github.com/sportsdataverse/sdvplot-js/tree/main/packages/sdvplot#readme) and [`@sportsdataverse/sdvtables`](https://github.com/sportsdataverse/sdvplot-js/tree/main/packages/sdvtables#readme).

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

To cite [**`@sportsdataverse/sporty`**](https://plot.sportsdataverse.org) in publications, cite sdvplot-js:

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

MIT. See [NOTICE.md](https://github.com/sportsdataverse/sdvplot-js/blob/main/packages/sporty/NOTICE.md) for the ported sportyR/sportypy material.
