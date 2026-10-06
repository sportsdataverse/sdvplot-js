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

`surface(sport, league, opts)` dispatches by sport; `leagues`, `features`, `displayRanges` and `colorKeys` list what each sport accepts. Options mirror sportyR: `updates` (parameter overrides), `colorUpdates`, `rotation`, `xTrans`, `yTrans`, `units` (`ft`, `m`, `yd`, `in`, `cm`, `mm`, any case, or a full name such as `"feet"`; anything else throws `UnknownUnitError`), `displayRange`, `xlim`, `ylim`, `arcResolution` (points per arc, default 200). Options are typed per sport, so a misspelled option or key is a compile error.

## Ported sports

| Sport | Leagues |
| --- | --- |
| basketball | `custom`, `fiba`, `nba`, `nba g league`, `ncaa`, `nfhs`, `wnba` |
| hockey | `ahl`, `custom`, `echl`, `iihf`, `ncaa`, `nhl`, `nwhl`, `ohl`, `phf`, `pwhl`, `qmjhl`, `ushl` |
| football | `cfl`, `custom`, `ncaa`, `nfhs11`, `nfhs6`, `nfhs8`, `nfhs9`, `nfl` |

The other six sports' generated parameter specs are importable from `@sportsdataverse/sporty/specs`; their surfaces are on the roadmap.

## Coordinate frames

`FRAMES` holds the source frames; `toSurfaceFrame(rows, { from, x?, y?, out? })` adds `surface_x`/`surface_y` (feet, surface origin; `null` for missing input). These move the data; sporty's `xTrans`/`yTrans` move the surface.

| Name | Source | Formula |
| --- | --- | --- |
| `nba-legacy` | stats.nba.com shots (tenths of a foot, hoop origin; inputs default to `x_legacy`/`y_legacy`) | `surface_x = -47 + 5.25 + y/10`, `surface_y = x/10` |
| `hockeytech-a` | HockeyTech 850x400 canvas, top-left origin | `(x - 425) * 200/850`, `(200 - y) * 85/400` |
| `hockeytech-b` | HockeyTech 600x300 canvas (fastRhockey) | `x/3 - 100`, `42.5 - y*85/300` |
| `espn-football-0-100` | ESPN yardline 0-100 | `x - 50`, `y` unchanged |

## Provenance and parity

Ported from sportyR 2.2.3 - see `NOTICE.md` (J3). The R package is the oracle: the test suite compares every feature of all 24 non-`custom` league surfaces point for point to 1e-9 against R output stored under `fixtures/sporty`, and a league without fixtures fails. Regenerate the fixtures with `pnpm oracle:sporty basketball hockey football` (needs R and sportyR); the oracle refuses to run unless the installed sportyR's `surface_dimensions` equals the vendored `data/surface-dimensions.json`, and records that file's sha256 in `fixtures/sporty/VERSION`. Parameter specs in `src/specs` are generated from the vendored JSON (`pnpm codegen`).

Drift gates in CI: `pnpm codegen --check` (specs match the vendored JSON) and `test/fixtures-version.test.ts` (the vendored JSON's sha256 and sportyR version/checkout match the ones the fixtures were generated from). `pnpm vendor --check` compares the vendored JSON with a sportyR checkout, so it only runs where one exists (`SPORTYR_REPO`); elsewhere it skips.

## Differences from sportyR

- An unknown `displayRange` throws `UnknownDisplayRangeError` (R silently falls back to `"full"`).
- `units` converts the anchors and display limits too (R converts only the feature points, so non-native units plot wrongly).
- Vector colours recycle per copy of a feature (`colorAt`), as R `data.frame()` does.
- A lane space mark takes its own set's colour; R reads row `i` (the lane index) of the set instead, which is `NA` once a court has more lanes than marks per set. Default leagues are unaffected.
- An `undefined`/`null` entry in `updates` or `colorUpdates` keeps the default.
- The `custom` league builds a surface from its all-zero defaults instead of erroring.
- Text features carry a `fitBox` (the ggfittext box) that the SVG renderer fits by height only.

## Roadmap

Soccer, baseball, tennis, volleyball, curling and lacrosse (Phase 6); canvas, plot and d3 renderers (Phases 3 and 6).

## Owner steps (before the first publish)

1. Create the `sportsdataverse` organization on npm.
2. Enable OIDC trusted publishing for `@sportsdataverse/sporty` (repository `sportsdataverse/sdvplot-js`, release workflow).

## License

MIT
