# @sportsdataverse/sporty

Sport surfaces (courts, rinks, fields) as plain geometry for SportsDataverse plots. TypeScript port of the R package [sportyR](https://github.com/sportsdataverse/sportyR) 2.2.3: every surface is a `Scene` of polygons and text, rendered by `@sportsdataverse/sporty/svg` today and by canvas/plot/d3 renderers later.

## Quick start

```ts
import { writeFileSync } from "node:fs";
import { basketballCourt, toSurfaceFrame } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";

writeFileSync("nba.svg", toSVG(basketballCourt("nba")));

// Move source data into the surface frame (feet, surface origin), then plot it over the SVG.
const shots = toSurfaceFrame([{ x_legacy: 120, y_legacy: 35 }], { from: "nba-legacy" });
// [{ x_legacy: 120, y_legacy: 35, surface_x: -38.25, surface_y: 12 }] -> plot (surface_x, surface_y) in feet
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

`surface(sport, league, opts)` dispatches by sport; `leagues`, `features`, `displayRanges` and `colorKeys` list what each sport accepts. Options mirror sportyR: `updates` (parameter overrides), `colorUpdates`, `rotation`, `xTrans`, `yTrans`, `units` (`ft`, `m`, `yd`, `in`, `cm`, `mm`, any case, or a full name such as `"feet"`; anything else throws `UnknownUnitError`), `displayRange`, `xlim`, `ylim`, `arcResolution` (points per arc, an integer >= 2, default 200). Options are typed per sport, so a misspelled option or key is a compile error.

## Subpaths

| Import | Contents |
| --- | --- |
| `@sportsdataverse/sporty` | `surface`, `SPORTS`, `basketballCourt`, `hockeyRink`, `footballField`, `soccerPitch`, `baseballField`, `tennisCourt`, `volleyballCourt`, `curlingSheet`, `lacrosseField`, `Scene`, `toSurfaceFrame`, `FRAMES`, errors |
| `@sportsdataverse/sporty/svg` | `toSVG` |
| `@sportsdataverse/sporty/specs` | generated parameter specs for all sports |
| `@sportsdataverse/sporty/plot` | `surfaceMark`, `surfaceScales`, `sceneToGeoJSON` (optional peer `@observablehq/plot`) |
| `@sportsdataverse/sporty/canvas` | `drawScene`, `SceneCanvasContext` (DOM-free; takes a browser 2D context or an `@napi-rs/canvas` one in Node) |
| `@sportsdataverse/sporty/d3` | `appendSurface` (optional peer `d3`) |

## Ported sports

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

## Coordinate frames

`FRAMES` holds the source frames; `toSurfaceFrame(rows, { from, x?, y?, out? })` adds `surface_x`/`surface_y` (feet, surface origin; `null` for missing input). These move the data; sporty's `xTrans`/`yTrans` move the surface.

| Name | Source | Formula |
| --- | --- | --- |
| `nba-legacy` | stats.nba.com shots (tenths of a foot, hoop origin; inputs default to `x_legacy`/`y_legacy`). Shots land on the -x half: pair with `displayRange: "defense"` | `surface_x = -47 + 5.25 + y/10`, `surface_y = x/10` |
| `hockeytech-a` | HockeyTech 850x400 canvas, top-left origin | `(x - 425) * 200/850`, `(200 - y) * 85/400` |
| `hockeytech-b` | HockeyTech 600x300 canvas (fastRhockey) | `x/3 - 100`, `42.5 - y*85/300` |
| `espn-football-0-100` | ESPN yardline 0-100 | `x - 50`, `y` unchanged |

## Provenance and parity

Ported from sportyR 2.2.3 - see [NOTICE.md](NOTICE.md) (J3). The R package is the oracle: the test suite compares every feature of all 53 non-`custom` league surfaces point for point to 1e-9 against R output stored under `fixtures/sporty`, and a league without fixtures fails. Regenerate the fixtures with `pnpm oracle:sporty basketball hockey football soccer baseball tennis volleyball curling lacrosse` (needs R and sportyR); the oracle refuses to run unless the installed sportyR's `surface_dimensions` equals the vendored `data/surface-dimensions.json`, and records that file's sha256 in `fixtures/sporty/VERSION`. Parameter specs in `src/specs` are generated from the vendored JSON (`pnpm codegen`).

Drift gates in CI: `pnpm codegen --check` (specs match the vendored JSON) and `test/fixtures-version.test.ts` (the vendored JSON's sha256 and sportyR version/checkout match the ones the fixtures were generated from). `pnpm vendor --check` compares the vendored JSON with a sportyR checkout, so it only runs where one exists (`SPORTYR_REPO`); elsewhere it skips.

## Differences from sportyR

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

## Roadmap

The canvas renderer (Phase 6).

## Owner steps (before the first publish)

1. Create the `sportsdataverse` organization on npm.
2. Enable OIDC trusted publishing for `@sportsdataverse/sporty` (repository `sportsdataverse/sdvplot-js`, release workflow).
3. Formalize the J3 licence understanding in writing before first publish (spec §9).

## License

MIT. See [NOTICE.md](NOTICE.md) for the ported sportyR/sportypy material.
