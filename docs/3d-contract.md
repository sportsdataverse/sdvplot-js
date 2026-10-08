# sporty 3D contract (J7: design the contract, ship 2.5D)

Status: contract only. v1 renderers (`sporty/svg`, `sporty/plot`, `sporty/canvas`) ignore `elevation`/`height`.
A future `@sportsdataverse/sporty-3d` (its own spec; depends on `three` as an optional peer) consumes this.

## 1. The two hints on `PolygonFeature`

| field | meaning | units | default |
|---|---|---|---|
| `elevation` | z of the polygon's BOTTOM face above the playing surface | `Scene.units` | 0 (painted on the surface) |
| `height` | extrusion along +z from `elevation` | `Scene.units` | 0 (flat decal) |

A polygon with `height > 0` is a solid prism: the plan-view polygon extruded by `height`, bottom at `elevation`.
A polygon with `height === 0` is a decal at `elevation` (lines, hashes, logos). `TextFeature` is always a decal at z = 0.

Caveat: outline/ring features (faceoff circles, the restricted-area trapezoid, the goal frame) are emitted as R-style seamed polygons (outer → seam → inner reversed). The even-odd 2D fill is correct, but triangulating them for 3D needs the seam split or explicit holes (see §6 question 7, J37).

## 2. Which features carry hints (as populated by `packages/sporty`)

The hints are set where the features are ADDED (`basketball/court.ts`, `hockey/rink.ts`), through a per-scene
`hint(ft)` that converts the real-world figure into `Scene.units`; the values below are the `ft` arguments.

| sport | feature name | elevation | height | real-world note |
|---|---|---|---|---|
| hockey | `boards` | 0 | 3.5 ft | NHL boards are 40–48 in; 3.5 ft is sportyR's figure |
| hockey | `goal_frame` | 0 | 4 ft | 6 ft × 4 ft frame; `goal_frame_fill` (the net, colour key `goal_fill`, `#a5acaf4d`) is a decal — see open question 3 |
| basketball | `basket_ring` | 10 ft | 0 | the ring is a torus; extruding an annulus is the 2.5D stand-in |
| basketball | `net` | 8.5 ft | 0 | hangs 15–18 in below the ring; a decal placeholder |
| basketball | `backboard` | — | 3.5 ft | VERTICAL plane: the plan-view polygon is a 6 ft × 4 in sliver; see open question 1 |
| football | (none yet) | — | — | goal posts: crossbar at 10 ft, uprights 35 ft (NFL) — proposed, not populated |

## 3. Coordinate frame and handedness

- `Scene` coordinates are math convention: x right, **y up**, origin per `Scene.origin` (`"center"` or `"home_plate"`),
  `bbox = [x0, y0, x1, y1]` with `y0 < y1`. `sporty/svg` and Observable Plot are y-DOWN screens; `toSVG` flips with
  `transform="scale(1,-1)"`. 3D renderers must NOT inherit that flip.
- The 3D contract fixes **Z-up**: the playing surface is the XY plane at z = 0, +z is up, right-handed. Scene (x, y)
  map 1:1 to world (x, y); `elevation`/`height` are z. three.js `ExtrudeGeometry` extrudes along +z, so a Shape built
  from the polygon in XY extrudes upward with no rotation.
- Engines that are Y-up by convention (three.js default camera `up`, Babylon) either set `camera.up = (0, 0, 1)` (the
  spike does this) or rotate the whole scene group by −90° about X (then Scene y → world −z; handedness preserved).
- `toSurfaceFrame(rows, { from })` output (`surface_x`, `surface_y`) is already in Scene coordinates; a 3D data layer
  takes `(surface_x, surface_y, z)` with `z` supplied by the caller (puck height, shot arc) or 0.

## 4. Units

`Scene.units` governs x, y, `elevation` and `height` alike. A 3D package converts once at load (`convertUnits`) and
sets the world unit; it never mixes units inside one scene.

## 5. Package boundary

`@sportsdataverse/sporty` stays renderer-agnostic and dependency-free. `@sportsdataverse/sporty-3d` (later spec):
`toThreeGroup(scene, opts) → THREE.Group`, with `three` as an optional peer; z-fighting handled by renderer-level
polygon offset per zIndex; text as decals. Team-colour painting stays in `sdvplot` (J10).

## 6. Open questions (to resolve in the sporty-3d spec)

1. Vertical surfaces (backboard, glass above the boards): a plan-view sliver extruded upward is a wall of the wrong
   thickness/orientation. Proposed: add `orientation?: "horizontal" | "vertical"` or a `kind: "wall"` feature.
2. Curved boards extrude fine (arcs are sampled points), but the glass above them has no feature at all.
3. Nets (hockey `goal_frame_fill`, basketball `net`) need a mesh/texture, not a prism; keep as decals with a `material` hint?
4. `basket_ring` as a torus: hint `profile: "torus"` vs. accept the annular prism.
5. Decals at the same z z-fight; renderer must offset by zIndex. Should the contract instead give lines a tiny
   `elevation` (e.g. 0.001)? Decision: no — renderer concern.
6. Football goal posts, soccer/lacrosse goals, baseball outfield walls: who populates, and at what defaults.
7. Holes: add `holes?: Polygon[]` additively to `PolygonFeature` (emitters split the rings) vs. a documented seam-split convention in `sporty-3d` (split at the repeated seam vertex before building a `Shape`). Spike finding 4; spec row J37.

## 7. Spike findings (spikes/three-surface, three 0.170, 2026-10-07)

1. Mapped cleanly: Scene (x, y) → three (x, y) with Z-up and `camera.up = (0,0,1)`; no flip needed. [visual observation, Playwright screenshot, not a `window.__spike` measurement: yes — `hockeyRink("nhl")` bbox `[-106.3, -54.3, 106.3, 54.3] ft` lands upright, 63 polygons, 0 degenerate geometries]
2. `ExtrudeGeometry(shape, { depth: height })` + `mesh.position.z = elevation` renders boards/goal frames as prisms. [4 extruded: `boards` ×2 at 3.5 ft, `goal_frame` ×2 at 4 ft; the boards stand up and follow the corner arcs]
3. Decals needed a per-zIndex z step of 0.001 ft to avoid z-fighting even with polygonOffset. [visual observation, Playwright screenshot, not a `window.__spike` measurement: with the step at 0 the faceoff-circle ring stipples against the ice sheet under an orthographic top-down camera; at 0.001 ft it is clean]
4. Polygons with holes (seam outlines, R-style): `Shape` with no `holes` renders the outline fill INCORRECTLY. [observed: 46 of 63 polygons revisit a vertex (the spike flags any revisited vertex; not proven hole vs. seam individually) (outer ring → seam → inner ring); three's earcut fills them as solid wedges/blocks — faceoff circles become red sectors, the restricted-area trapezoid a solid wedge, and the extruded `goal_frame` a solid 4 ft red box instead of a hollow frame. The centre circle and faceoff-spot rings happen to survive]
5. `#rrggbbaa` fills → material opacity; the goal fill at 0.3 alpha reads as a net stand-in. [visual observation, Playwright screenshot, not a `window.__spike` measurement: `goal_frame_fill` `#a5acaf4d` → opacity 0.30, a faint grey slab over the crease behind the frame]
6. `toSurfaceFrame("hockeytech-b")` points landed inside the rink; the trail at z = 0.3 ft is visible above decals. [observed: 20/20 rows inside the bbox (x −80…72 ft, |y| ≤ 25.5 ft), y flipped from the y-down canvas by the frame itself; pucks and the yellow trail sit visibly above the ice]
7. Contract is MISSING: a vertical-surface hint (backboard would extrude as a 4 in wall of the wrong orientation).
8. Contract is MISSING: glass above the boards (no feature), net geometry (prism is wrong), ring profile — and, from finding 4, an explicit hole representation (`holes?: Polygon[]` on `PolygonFeature`, or a documented seam convention the 3D renderer splits on); without it every outline feature is mis-filled.
9. Contract is SUFFICIENT for what the spike measured: boards and goal-frame extrusion (heights/elevations) plus seam detection, and data layers via the frame registry (solid fills such as crease, benches and zones were not inspected individually); NOT YET for outline/ring features (finding 4) or the hollow goal frame.
10. Recommendation for sporty-3d: keep Z-up; add `orientation`; add `holes` (or split seamed rings at the shared vertex before building a `Shape`); renderer owns z-fighting (0.001-unit zIndex step, polygonOffset alone is not enough); `three` optional peer.
