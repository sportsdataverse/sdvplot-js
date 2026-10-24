/**
 * The Three.js adapter: sporty playing surfaces and team-coloured trajectories (a pitch, a ball flight) as plain mesh
 * buffers (`Float32Array` positions and colours, `Uint32Array` indices) in world units: the surface's own feet or
 * metres, z up. Pure: it never imports three.js (`three` 0.186.1 or later is an optional peer), so the buffers can be
 * built anywhere, a server included; hand them to a `BufferGeometry`, or draw them with the `<Surface3D>` and
 * `<Trajectory>` react-three-fiber components in `sdvplot/react`. `surfaceMesh` draws through
 * `@sportsdataverse/sporty`, which this entry imports when it loads. Synchronous: call after `loadLeague(league)` /
 * `preloadAll()` for team colours. three.js's camera looks along -z with +y up by default; these meshes put the
 * ground in the x-y plane with +z up, so set `camera.up.set(0, 0, 1)` (or rotate their group -90 degrees about x).
 */
export { type StatcastPathOptions, type StatcastPitch, statcastPitchPath } from "./statcast.js";
export { type SurfaceLoop, type SurfaceMesh, surfaceMesh } from "./surface.js";
export {
  type Point3,
  type ThreeColorOptions,
  type TrajectoryTubeOptions,
  type TubeMesh,
  teamColorPalette,
  trajectoryTube,
} from "./tube.js";
