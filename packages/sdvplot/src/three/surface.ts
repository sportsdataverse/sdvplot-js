import { type PolygonFeature, surface as sportySurface } from "@sportsdataverse/sporty";
import type { LeagueOf, OptionsOf, Sport, Units } from "@sportsdataverse/sporty";

/** One closed loop of `surfaceMesh`: where its vertices and triangles sit in the mesh buffers. */
export interface SurfaceLoop {
  /** The sporty feature it comes from (e.g. "infield_dirt"), or "background" for the surface's own background. */
  name: string;
  /** The feature's sporty fill, `#rrggbb` or `#rrggbbaa`, as sporty gives it. */
  color: string;
  /** Its first vertex and number of vertices. */
  vertexStart: number;
  vertexCount: number;
  /** Its first index and number of indices (three per triangle). */
  indexStart: number;
  indexCount: number;
}
/**
 * A sporty playing surface as one triangle mesh in the z = 0 plane, in the surface's own units and frame (feet for a
 * baseball field or a rink, metres for a pitch; origin where sporty puts it), ready for a three.js `BufferGeometry`.
 */
export interface SurfaceMesh {
  /** x, y, z per vertex; z is 0. */
  positions: Float32Array;
  /** r, g, b, a per vertex, 0 to 1, in linear sRGB (three.js's working colour space): a vertex-colour attribute. */
  colors: Float32Array;
  /** Three vertex indices per triangle, counter-clockwise seen from +z, back to front. */
  indices: Uint32Array;
  /** Every loop, in drawing order (later ones lie over earlier ones in the same plane). */
  loops: SurfaceLoop[];
  units: Units;
  /** The surface's extent, `[x0, y0, x1, y1]`. */
  bbox: readonly [x0: number, y0: number, x1: number, y1: number];
}

type Pt = readonly [x: number, y: number];
/**
 * A feature's path as closed loops. sporty (after sportyR) draws some features as two loops in one path, such as a
 * faceoff circle's two half rings each closing back on its first point: an SVG or canvas fill draws that as it is, but
 * a triangulation of the path as one ring fills the wrong side of it (deck.gl's earcut did). A loop ends where the path
 * comes back to that loop's first point, after at least two other points (a repeated first point does not end it):
 * the rule of `sdvplot/deckgl` and sdvplot.pydeck. ponytail: a loop inside another would be filled, not cut out as a
 * hole; sporty builds every ring from two half rings, so none is.
 */
function loops(points: readonly Pt[]): Pt[][] {
  const out: Pt[][] = [];
  let loop: Pt[] = [];
  let away = 0; // points of this loop that are not its first
  for (const p of points) {
    const first = loop[0];
    loop.push(p);
    if (first === undefined) continue;
    if (p[0] !== first[0] || p[1] !== first[1]) away++;
    else if (away >= 2) {
      out.push(loop);
      loop = [];
      away = 0;
    }
  }
  if (away >= 2) out.push(loop); // an open path, closed like a fill
  return out;
}

const turn = (a: Pt, b: Pt, c: Pt): number => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);

/**
 * A loop as a simple counter-clockwise ring: no repeated point, no point on a straight run between its neighbours
 * (or a spike back on itself), which add nothing to the area and leave an ear-clipper with zero-area ears.
 */
function ring(loop: readonly Pt[]): Pt[] {
  const r = loop.filter((p, i) => {
    const q = loop[(i + 1) % loop.length] as Pt;
    return p[0] !== q[0] || p[1] !== q[1];
  });
  // flat: the corner's sine under 1e-9, i.e. straight up to rounding
  const flat = (p: Pt, i: number): boolean => {
    const [a, c] = [r[(i - 1 + r.length) % r.length] as Pt, r[(i + 1) % r.length] as Pt];
    return (
      Math.abs(turn(a, p, c)) <=
      1e-9 * Math.hypot(p[0] - a[0], p[1] - a[1]) * Math.hypot(c[0] - p[0], c[1] - p[1])
    );
  };
  for (let i = r.findIndex(flat); i >= 0 && r.length >= 3; i = r.findIndex(flat)) r.splice(i, 1);
  const area = signedArea(r);
  return area < 0 ? r.reverse() : r;
}
function signedArea(r: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const [a, b] = [r[i] as Pt, r[(i + 1) % r.length] as Pt];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}
/**
 * No area to fill: a path that goes out along a line and back along it (the NLL goal fan), which a fill leaves
 * invisible, as sporty's own SVG does, or the sliver left where a ring touched itself.
 */
function empty(r: readonly Pt[]): boolean {
  let [x0, y0, x1, y1] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (const [x, y] of r)
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  return r.length < 3 || Math.abs(signedArea(r)) <= 1e-9 * ((x1 - x0) ** 2 + (y1 - y0) ** 2);
}

/**
 * A ring that crosses itself split at each crossing into rings that do not, each to be filled: what an SVG fill shows
 * of a figure-of-eight. sporty has a few: the NHL goaltender's trapezoids and the faceoff hash marks nearest centre
 * ice twist at their corners by an inch. Rings come back un-oriented (`ring` orients them).
 */
function simple(r: readonly Pt[]): Pt[][] {
  const n = r.length;
  const side = (a: Pt, b: Pt, c: Pt): number => Math.sign(turn(a, b, c));
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // neighbours across the closing edge
      const [a, b, c, d] = [r[i] as Pt, r[(i + 1) % n] as Pt, r[j] as Pt, r[(j + 1) % n] as Pt];
      if (side(a, b, c) * side(a, b, d) >= 0 || side(c, d, a) * side(c, d, b) >= 0) continue;
      const s = turn(c, d, a) / (turn(c, d, a) - turn(c, d, b)); // where the crossing is along a -> b
      const x: Pt = [a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1])];
      return [
        ...simple([...r.slice(0, i + 1), x, ...r.slice(j + 1)]),
        ...simple([x, ...r.slice(i + 1, j + 1)]),
      ];
    }
  return [[...r]];
}

/**
 * Ear clipping of a simple counter-clockwise ring: n - 2 triangles, as indices into it. An ear is a convex corner whose
 * triangle holds no other corner of the ring; only reflex corners can lie in one, so only they are checked.
 * ponytail: O(n²) in the worst case; sporty's longest loop is about 800 points.
 */
function triangulate(r: readonly Pt[]): number[] {
  const n = r.length;
  const prev = Array.from({ length: n }, (_, i) => (i - 1 + n) % n);
  const next = Array.from({ length: n }, (_, i) => (i + 1) % n);
  const convex = (i: number): boolean =>
    turn(r[prev[i] as number] as Pt, r[i] as Pt, r[next[i] as number] as Pt) > 0;
  const reflex = new Set<number>();
  for (let i = 0; i < n; i++) if (!convex(i)) reflex.add(i);
  const inside = (p: Pt, a: Pt, b: Pt, c: Pt): boolean =>
    turn(a, b, p) >= 0 && turn(b, c, p) >= 0 && turn(c, a, p) >= 0;
  const ear = (i: number): boolean => {
    if (!convex(i)) return false;
    const [a, b, c] = [prev[i] as number, i, next[i] as number];
    for (const j of reflex) {
      if (j === a || j === b || j === c) continue;
      const p = r[j] as Pt;
      const same = (q: number): boolean => p[0] === (r[q] as Pt)[0] && p[1] === (r[q] as Pt)[1];
      if (!same(a) && !same(c) && inside(p, r[a] as Pt, r[b] as Pt, r[c] as Pt)) return false;
    }
    return true;
  };
  const out: number[] = [];
  let i = 0;
  let left = n;
  let tried = 0;
  while (left > 3) {
    // ponytail: with no ear left (a ring that is not simple), clip the corner anyway rather than loop forever
    if (ear(i) || tried > left) {
      const [a, c] = [prev[i] as number, next[i] as number];
      out.push(a, i, c);
      next[a] = c;
      prev[c] = a;
      reflex.delete(i);
      for (const k of [a, c]) if (convex(k)) reflex.delete(k);
      left--;
      tried = 0;
      i = c;
    } else {
      i = next[i] as number;
      tried++;
    }
  }
  out.push(prev[i] as number, i, next[i] as number);
  return out;
}

/** "#rrggbb" or "#rrggbbaa" as r, g, b in linear sRGB and a, each 0 to 1. */
function linear(color: string): [number, number, number, number] {
  const c = color.replace(/^#/, "");
  const lin = (s: number): number => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0, 2, 4].map((i) => lin(Number.parseInt(c.slice(i, i + 2), 16) / 255));
  return [r as number, g as number, b as number, c.length === 8 ? Number.parseInt(c.slice(6), 16) / 255 : 1];
}

const drawn = (f: PolygonFeature): boolean =>
  f.points.length > 0 &&
  f.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) &&
  !(f.fill.length === 9 && f.fill.endsWith("00"));

/**
 * sporty's playing surface for `sport` and `league` (sporty's own league keys, e.g. `surfaceMesh("baseball", "mlb")`,
 * `surfaceMesh("hockey", "nhl")`) as one triangle mesh in the z = 0 plane: plain buffers (positions, linear-sRGB
 * vertex colours, indices), with no three.js import, ready for `new BufferGeometry()` in three.js or the `<Surface3D>`
 * component in `sdvplot/react`. World units: the surface's own (feet for a baseball field or a rink, metres for a
 * pitch), in sporty's frame: a baseball field has home plate's point at the origin and +y towards centre field,
 * Statcast's frame, so `statcastPitchPath` points draw over it unconverted; the other surfaces have the origin at
 * their centre. The surface's background colour (a baseball field's outfield grass) is the first loop, over the
 * extent; then each closed loop of each polygon feature, in sporty's drawing order (a faceoff circle is two loops,
 * its half rings), filled with its colour, alpha included. Hidden features (a `#rrggbb00` fill) and text (a football
 * field's numbers) are left out, and sporty's heights (goal frames, backboards) are flattened: z is 0 throughout.
 * Every loop lies in one plane, so draw the mesh in order without depth writes (`depthWrite: false`), first
 * (`renderOrder` -1), with `vertexColors`, `transparent` and `toneMapped: false`, as `<Surface3D>` does: later loops
 * then paint over earlier ones with no z-fighting. `o` is passed to sporty's `surface()` (`colorUpdates`, `units`,
 * `rotation`, ...).
 *
 * @example
 * ```ts
 * import { surfaceMesh } from "@sportsdataverse/sdvplot/three";
 *
 * const field = surfaceMesh("baseball", "mlb");
 * // in three.js: geometry.setAttribute("position", new BufferAttribute(field.positions, 3)), and so on
 * field.loops.map((l) => l.name);
 * ```
 */
export function surfaceMesh<S extends Sport>(
  sport: S,
  league: LeagueOf<S>,
  o: OptionsOf<S> = {} as OptionsOf<S>,
): SurfaceMesh {
  const scene = sportySurface(sport, league, o);
  const [x0, y0, x1, y1] = scene.bbox;
  const parts: { name: string; color: string; ring: Pt[] }[] = [];
  if (scene.background !== undefined)
    parts.push({
      name: "background",
      color: scene.background,
      ring: ring([
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ]),
    });
  // ponytail: features draw in array order (sporty's zIndex is its position); sort here if that ever changes
  for (const f of scene.features)
    if (f.kind === "polygon" && drawn(f))
      for (const l of loops(f.points))
        for (const s of simple(ring(l))) {
          const r = ring(s);
          if (!empty(r)) parts.push({ name: f.name, color: f.fill, ring: r });
        }
  const vertices = parts.reduce((s, p) => s + p.ring.length, 0);
  const positions = new Float32Array(vertices * 3);
  const colors = new Float32Array(vertices * 4);
  const indices = new Uint32Array(parts.reduce((s, p) => s + 3 * (p.ring.length - 2), 0));
  const out: SurfaceLoop[] = [];
  let v = 0;
  let i = 0;
  for (const { name, color, ring: r } of parts) {
    const rgba = linear(color);
    r.forEach(([x, y], k) => {
      positions.set([x, y, 0], 3 * (v + k));
      colors.set(rgba, 4 * (v + k));
    });
    const tris = triangulate(r);
    indices.set(
      tris.map((t) => t + v),
      i,
    );
    out.push({ name, color, vertexStart: v, vertexCount: r.length, indexStart: i, indexCount: tris.length });
    v += r.length;
    i += tris.length;
  }
  return { positions, colors, indices, loops: out, units: scene.units, bbox: scene.bbox };
}
