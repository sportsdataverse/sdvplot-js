import { colorList } from "../_web.js";
import { hex6 } from "../contrast.js";
import { InputError } from "../errors.js";
import { type Value, resolveSync } from "../resolve.js";
import { teamPalette } from "../team-palette.js";
import type { IdSystem, League, SeasonInput, TeamId, Which } from "../types.js";

/** `teamColorPalette` options. */
export interface ThreeColorOptions {
  /** "primary" (default) or "secondary": the team colour each team gets. */
  which?: Which;
  season?: SeasonInput;
  idSystem?: IdSystem;
  /** The colour of a team that does not resolve. Default "#808080". */
  fallback?: string;
  /**
   * The scene's background (what the colours are seen against, such as the surface under them). Given, a colour under
   * 3:1 contrast against it is swapped for the team's other colour, else moved towards white (on a dark background)
   * or black (a light one) until it reads; a colour that would then sit too close to an earlier team's (CIE76 ΔE under
   * 20) takes the team's other colour, or the nearest colour to its own that is distinct and still reads; failing that
   * it is kept, with one warning. A team that does not resolve keeps `fallback` and stays out of that search.
   */
  background?: string;
}

/**
 * One colour per team, in order, for each team's mesh material (a `Trajectory`'s `color`, a `MeshBasicMaterial`'s
 * `color`). With `background`, every colour keeps 3:1 contrast against it (dark mode) and the teams stay distinct. A
 * team listed twice gets one colour.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorPalette } from "@sportsdataverse/sdvplot/three";
 *
 * await loadLeague("mlb");
 * teamColorPalette("mlb", ["NYY", "CWS"], { background: "#395d33" }); // readable on sporty's baseball grass
 * ```
 */
export function teamColorPalette(
  league: League,
  teams: readonly unknown[],
  o: ThreeColorOptions = {},
): string[] {
  const fallback = hex6(o.fallback ?? "#808080");
  const season = o.season === undefined ? {} : { season: o.season };
  const ids = resolveSync(teams as readonly Value[], league, {
    ...season,
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  });
  const known: string[] = [...new Set(ids.filter((id): id is TeamId => id !== undefined && id !== null))];
  const which = o.which ?? "primary";
  const co = { ...season, idSystem: "team_id" as const };
  const main = colorList(league, known, { ...co, which });
  const other = colorList(league, known, { ...co, which: which === "primary" ? "secondary" : "primary" });
  // a team with no `which` colour (often no secondary) takes its other colour, then the fallback
  let colors = main.map((c, i) => hex6(c ?? other[i] ?? fallback, { dropAlpha: true }));
  if (o.background !== undefined) colors = teamPalette(colors, other, hex6(o.background), known);
  const by = new Map(known.map((id, i) => [id, colors[i] as string]));
  return ids.map((id) => (id === undefined ? fallback : (by.get(id) as string)));
}

/** A point in world units: `[x, y, z]`, z up. */
export type Point3 = readonly [x: number, y: number, z: number];
type P3 = Point3;
/** `trajectoryTube` options: the radius in world units, and either a colour or a team. */
export interface TrajectoryTubeOptions extends Omit<ThreeColorOptions, "fallback"> {
  /**
   * The tube's radius in world units: the points' own units (feet for a pitch over a baseball field), not px. Three.js
   * draws in the scene's units, so a tube is as thick as this whatever the camera; a baseball's radius is 0.121 ft.
   */
  radius: number;
  /** Vertices round each ring, 3 or more. Default 12. */
  radialSegments?: number;
  /** The tube's colour, `#rrggbb`. Give this or `team` and `league`. */
  color?: string;
  /** The team whose colour the tube takes (abbreviation, name or id), with `league`. */
  team?: unknown;
  league?: League;
  /** The colour of a team that does not resolve. Default "#808080". */
  fallback?: string;
}
/** A tube mesh, ready for a three.js `BufferGeometry` (world units). */
export interface TubeMesh {
  /** x, y, z per vertex: `radialSegments` vertices round each point of the path, ring after ring. */
  positions: Float32Array;
  /** The outward unit normal of each vertex. */
  normals: Float32Array;
  /** Three vertex indices per triangle, counter-clockwise seen from outside the tube. */
  indices: Uint32Array;
  /** The tube's colour, `#rrggbb` (sRGB, as a three.js `Color` takes it). */
  color: string;
  radius: number;
  /** The path's length, world units. */
  length: number;
}

const real = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const minus = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: P3, b: P3): P3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: P3, b: P3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: P3): P3 => {
  const n = Math.sqrt(dot(a, a));
  return [a[0] / n, a[1] / n, a[2] / n];
};

/**
 * A tube along a 3D polyline (a pitch, a ball flight, a skater's path) as plain mesh buffers, in the points' own world
 * units: ready for `new BufferGeometry()` in three.js, or the `<Trajectory>` component in `sdvplot/react` for
 * react-three-fiber. The tube is `radius` round (world units, not px), one ring of `radialSegments` vertices at each
 * point, the rings turned along the path without twisting (each ring's frame is the last one's, carried along: a
 * parallel-transport frame), with open ends. Its colour is `color`, or the team's (`team` and `league`; `background`
 * makes it read against the scene, as `teamColorPalette` does); draw it with that colour unlit and not tone-mapped
 * (`MeshBasicMaterial`, `toneMapped: false`) to show the team's colour as it is. A repeated point is skipped.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { statcastPitchPath, trajectoryTube } from "@sportsdataverse/sdvplot/three";
 *
 * await loadLeague("mlb");
 * // a 96.3 mph four-seamer, Yankees at Red Sox, 2024-06-15 (Baseball Savant: game 746946, at-bat 48, pitch 4)
 * const pitch = {
 *   vx0: -6.245145230392043, vy0: -140.0548111003631, vz0: -4.647911601289857,
 *   ax: 12.681580763686934, ay: 32.15363682007945, az: -12.428443024407864,
 *   plate_x: 0.42927397039380755, plate_z: 3.546869816011372, release_pos_y: 54.12, game_year: 2024,
 * };
 * const tube = trajectoryTube(statcastPitchPath(pitch), { radius: 0.121, team: "NYY", league: "mlb" });
 * // in three.js: geometry.setAttribute("position", new BufferAttribute(tube.positions, 3)), and so on
 * tube.color;
 * ```
 */
export function trajectoryTube(points: readonly Point3[], o: TrajectoryTubeOptions): TubeMesh {
  for (const k of ["width", "size", "lineWidth", "height"])
    if (k in o)
      throw new InputError(
        `trajectoryTube takes no ${k}: three.js draws in world units, so give radius in the points' own units, not px`,
      );
  if (!(real(o.radius) && o.radius > 0))
    throw new InputError(
      `radius is the tube's radius in the points' world units, greater than 0, got ${String(o.radius)}`,
    );
  const segments = o.radialSegments ?? 12;
  if (!(Number.isInteger(segments) && segments >= 3))
    throw new InputError(`radialSegments is a whole number, 3 or more, got ${String(segments)}`);
  if ((o.color === undefined) === (o.team === undefined))
    throw new InputError("trajectoryTube takes a color or team (with league), one of the two");
  let color: string;
  if (o.color !== undefined) color = hex6(o.color);
  else {
    if (o.league === undefined) throw new InputError("trajectoryTube's team needs its league");
    const { radius: _r, radialSegments: _s, color: _c, team: _t, league: _l, ...co } = o;
    color = teamColorPalette(o.league, [o.team], co)[0] as string;
  }

  const path: P3[] = [];
  for (const p of points) {
    if (!(p.length === 3 && p.every(real)))
      throw new InputError(`each point is [x, y, z], three finite numbers, got ${JSON.stringify(p)}`);
    const last = path[path.length - 1];
    if (last === undefined || last[0] !== p[0] || last[1] !== p[1] || last[2] !== p[2]) path.push(p);
  }
  if (path.length < 2) throw new InputError("trajectoryTube needs at least two different points");

  const n = path.length;
  const tangents = path.map((_, k) =>
    unit(minus(path[Math.min(k + 1, n - 1)] as P3, path[Math.max(k - 1, 0)] as P3)),
  );
  // the first ring's frame: a normal square to the first tangent, from the axis it leans on least
  const t0 = tangents[0] as P3;
  const ax =
    Math.abs(t0[0]) <= Math.abs(t0[1]) && Math.abs(t0[0]) <= Math.abs(t0[2])
      ? 0
      : Math.abs(t0[1]) <= Math.abs(t0[2])
        ? 1
        : 2;
  let normal = unit(cross(t0, [ax === 0 ? 1 : 0, ax === 1 ? 1 : 0, ax === 2 ? 1 : 0]));
  const positions = new Float32Array(n * segments * 3);
  const normals = new Float32Array(n * segments * 3);
  let length = 0;
  path.forEach((p, k) => {
    const t = tangents[k] as P3;
    if (k > 0) {
      length += Math.sqrt(dot(minus(p, path[k - 1] as P3), minus(p, path[k - 1] as P3)));
      // carry the last normal along: take out its part along the new tangent (no twist about the path)
      const along = dot(normal, t);
      const carried: P3 = [normal[0] - along * t[0], normal[1] - along * t[1], normal[2] - along * t[2]];
      // ponytail: a turn of 90 degrees or more between two points loses the frame; a pitch or ball flight never does
      if (dot(carried, carried) > 1e-12) normal = unit(carried);
    }
    const binormal = cross(t, normal);
    for (let j = 0; j < segments; j++) {
      const a = (2 * Math.PI * j) / segments;
      const d: P3 = [
        Math.cos(a) * normal[0] + Math.sin(a) * binormal[0],
        Math.cos(a) * normal[1] + Math.sin(a) * binormal[1],
        Math.cos(a) * normal[2] + Math.sin(a) * binormal[2],
      ];
      const v = 3 * (k * segments + j);
      for (let c = 0; c < 3; c++) {
        positions[v + c] = (p[c] as number) + o.radius * (d[c] as number);
        normals[v + c] = d[c] as number;
      }
    }
  });
  const indices = new Uint32Array((n - 1) * segments * 6);
  let i = 0;
  for (let k = 0; k < n - 1; k++)
    for (let j = 0; j < segments; j++) {
      const a = k * segments + j;
      const b = k * segments + ((j + 1) % segments);
      const c = a + segments;
      const d = b + segments;
      indices.set([a, b, c, b, d, c], i);
      i += 6;
    }
  return { positions, normals, indices, color, radius: o.radius, length };
}
