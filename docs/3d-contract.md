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

## 7. Spike findings (Task 11 appends here)
