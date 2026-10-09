# @sportsdataverse/sporty

## 0.1.0

### Minor Changes

- 0b91a00: Basketball, hockey and football surfaces (24 leagues), matching sportyR point for point: `surface(sport, league)` builds a `Scene`, `toSVG` (`sporty/svg`) draws it, and `toSurfaceFrame` moves data rows between the coordinate frames in `FRAMES`.
- 0b91a00: Soccer, baseball, tennis, volleyball, curling and lacrosse surfaces (29 leagues, point-for-point sportyR parity); display limits follow the requested units. `surface()` and the `leagues`/`features`/`displayRanges`/`colorKeys` discovery tables cover all nine sports with typed per-sport options, and `SPORTS` lists them; an unknown sport throws `UnknownLeagueError`.
- 0b91a00: Every surface sporty draws is described for screen readers: `surfaceMark` (`sporty/plot`), `toSVG` (`sporty/svg`) and `appendSurface` (`sporty/d3`, optional fifth argument) take an `ariaDescription`, defaulting to "nba basketball surface" and so on.
- 0b91a00: Basketball shot zones and the hoop-at-the-bottom frame: `basketballZoneOf`, `basketballZones`, `BASKETBALL_ZONES`, `BASKETBALL_ZONE_LABELS`, and the `nba-legacy-vertical` frame in `FRAMES`.
- bab3b04: `@sportsdataverse/sporty/canvas` renderer (`drawScene`, `SceneCanvasContext`; DOM-free, takes a browser 2D context or an `@napi-rs/canvas` one in Node); `toSVG`'s `arcs: "svg"` option replaces detected circle runs with SVG `A` commands (one per quarter turn).
- 0b91a00: Observable Plot and d3 integrations: `sporty/plot` (`surfaceMark`, `surfaceScales`, `sceneToGeoJSON`) and `sporty/d3` (`appendSurface`).
