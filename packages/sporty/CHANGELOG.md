# @sportsdataverse/sporty

## 0.3.0

### Minor Changes

- 446a525: The README and the type declarations' comments no longer cite internal decision or plan ids.
- 065b53b: Surfaces follow sportyR 2.4.5 (re-vendored at e021040, every oracle fixture regenerated). A feature with no area and no visible outline is no longer drawn, as in sportyR 2.4.1: zero-thickness lines such as the NLL sidelines and end lines, the NCAA men's goal arc and the NCAA men's neutral zone are left out (NBA draws 104 features, was 106), and the all-zero `custom` baseball, hockey and softball surfaces have no features. Hockey and lacrosse features are simple closed rings: the goaltender's trapezoid is two strips, the second set of faceoff lines mirrors the first, the centre faceoff circle and the benches close on their first point, the nhl98 crease's inner arc meets its inner sides, the nhl92 crease is its arc band and two L-marks, the lacrosse goal frame and net close, and the lacrosse goal mouth's stubs end on the inner arc. Rectangular lacrosse fields stop their defensive and offensive zones at the neutral zone. The contrasting lacrosse centre face-off marker compares hex colours by value, so a `center_line` of `#FFFFFF` or `#ffffffff` still gets it. Circles are drawn with `cospi`/`sinpi`, so quarter points sit exactly on the axes.

### Patch Changes

- fffc941: The nhl98 goal crease outline's inner arc now ends exactly on its inner straight sides instead of about 4e-16 ft across them, so a renderer that splits rings where they cross (sdvplot's deck.gl `surfaceLayer`) no longer drops the crease's corner points.
- 065b53b: `toSVG`, `drawScene` (`/canvas`), `appendSurface` (`/d3`) and `sceneToGeoJSON`/`surfaceMark` (`/plot`) fill each closed ring of a feature as its own sub-path, wound so a ring inside another is a hole and any other ring is filled once. sportyR fills the nhl92 crease's band and L-marks (and the goaltender trapezoid's two strips) as separate polygons; drawn as one joined path, the OHL and QMJHL creases showed a red triangle inside them. The lacrosse contrasting centre marker also matches a centre line given as a CSS colour name or short hex (`"white"`, `"#fff"`).

## 0.2.0

### Minor Changes

- 125b8f4: NCAA softball field: `softballField()` and `surface("softball", ...)`, a port of sportyR 2.4.0 `geom_softball()` (pitcher's circle and lane, coaches' boxes, softball batter's and catcher's boxes), checked point for point against R. New exports: `softballField`, `SOFTBALL_LEAGUES`, `SOFTBALL_SPECS`, `SOFTBALL_FEATURES`, `SOFTBALL_DISPLAY_RANGES`, `SOFTBALL_COLOR_KEYS` and their types; `SPORTS` and `Sport` gain `"softball"`.
- 125b8f4: Re-vendored from sportyR 2.4.0 (main at b97443a, which merged sportyR PR #68), with its geometry fixes ported and every oracle fixture regenerated. Changed output: NLL and World Lacrosse draw a real 85 ft neutral zone (#60); lacrosse penalty-box fills sit 0.25 ft further out, at `boards_thickness` (#61); the women's 8 m arc follows the rule (NCAA 2026-27 Rule 1 §6-7): 45-degree lines from the goal circle on the goal line extended to an arc 10.6 m from the goal-line centre, hash marks centred on the middle of that arc's line (10.5495 m, #75) at the angle they are rotated by, and 0.305 m goal-line-extended marks (#62, #69); the PLL two-point arc runs parallel to the sideline 13 yd out, then a 15 yd arc (#70); lacrosse leagues without a goal fan no longer get an empty goal-fan polygon (two fewer features; the picture is unchanged); the full lacrosse display range covers benches and penalty boxes (NLL / World Lacrosse y to ±48 ft, #63); a goal arc without a line thickness draws as a ring (#64); each NLL / World Lacrosse penalty box is 8 ft inside, its outer wall 0.25 ft further out (#72); the contrasting centre face-off colour is applied after the user's colours and only when the marker matches the centre line, so recolouring `center_line` keeps the marker white (#65); the NCAA football coaching line sits 6 ft outside the sideline (`restricted_area_width` 1.8889 yd, #66); NCAA, NFHS and NFL fields get a white border outline by default (`field_bordered`), CFL unchanged (#67); the NFL trapezoid bench's outer border corner follows the slanted side (19.41 to 19.15 yd, #71); and a translated football field moves its yard-number boxes once, not twice (#76). Drawing in other units now matches sportyR (#74), which scales the whole plot as sporty already did, so that is no longer a documented difference.

## 0.1.0

### Minor Changes

- 0b91a00: Basketball, hockey and football surfaces (24 leagues), matching sportyR point for point: `surface(sport, league)` builds a `Scene`, `toSVG` (`sporty/svg`) draws it, and `toSurfaceFrame` moves data rows between the coordinate frames in `FRAMES`.
- 0b91a00: Soccer, baseball, tennis, volleyball, curling and lacrosse surfaces (29 leagues, point-for-point sportyR parity); display limits follow the requested units. `surface()` and the `leagues`/`features`/`displayRanges`/`colorKeys` discovery tables cover all nine sports with typed per-sport options, and `SPORTS` lists them; an unknown sport throws `UnknownLeagueError`.
- 0b91a00: Every surface sporty draws is described for screen readers: `surfaceMark` (`sporty/plot`), `toSVG` (`sporty/svg`) and `appendSurface` (`sporty/d3`, optional fifth argument) take an `ariaDescription`, defaulting to "nba basketball surface" and so on.
- 0b91a00: Basketball shot zones and the hoop-at-the-bottom frame: `basketballZoneOf`, `basketballZones`, `BASKETBALL_ZONES`, `BASKETBALL_ZONE_LABELS`, and the `nba-legacy-vertical` frame in `FRAMES`.
- bab3b04: `@sportsdataverse/sporty/canvas` renderer (`drawScene`, `SceneCanvasContext`; DOM-free, takes a browser 2D context or an `@napi-rs/canvas` one in Node); `toSVG`'s `arcs: "svg"` option replaces detected circle runs with SVG `A` commands (one per quarter turn).
- 0b91a00: Observable Plot and d3 integrations: `sporty/plot` (`surfaceMark`, `surfaceScales`, `sceneToGeoJSON`) and `sporty/d3` (`appendSurface`).
