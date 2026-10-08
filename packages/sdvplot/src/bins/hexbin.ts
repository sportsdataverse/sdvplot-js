// hexbin() and hexagonPath() port d3-hexbin 0.2.2 src/hexbin.js:1-2, :23-72 (Copyright 2012-2016 Mike Bostock,
// BSD-3-Clause; full notice in NOTICE.md). Same lattice, bin order and centres, so bins equal d3-hexbin's.
import { InputError } from "../errors.js";

const THIRD_PI = Math.PI / 3;
const ANGLES = [0, THIRD_PI, 2 * THIRD_PI, 3 * THIRD_PI, 4 * THIRD_PI, 5 * THIRD_PI];

/** One bin of either shape (`hexbin`, `squarebin`): the points in it, plus its centre in the points' own units. */
export type BinOf<T> = T[] & { x: number; y: number };

/**
 * Bin points into pointy-top hexagons of circumradius `radius`, in the points' OWN units (data space, not
 * pixels). Points with a NaN coordinate are skipped. Centres of `-0` are folded to `0` (blazing-the-nets
 * `main` `lib/data/aggregate.ts:101`), so equal hexes share one key. Throws `InputError` unless `radius` is a finite
 * number greater than 0.
 *
 * Each point goes to the centre upstream d3-hexbin picks, which is close to but not exactly the nearest one: it
 * compares two candidates' squared distances in lattice units (x over √3·radius, y over 1.5·radius; `:43`), so
 * about 1-2% of points sit just outside the hexagon drawn for their bin (on the real BKN fixture, 22 of 2000 shots
 * at radius 10 and 37 of 2000 at radius 15). That is faithful to d3-hexbin and to blazing-the-nets, which draw the
 * same; do not "fix" it. Squares (`squarebin`) contain every point they bin.
 *
 * @example
 * ```ts
 * import { hexbin } from "@sportsdataverse/sdvplot/bins";
 *
 * // three Brooklyn shots of 2025-26 in tenths of a foot from the hoop (sportsdataverse-data nba_stats_shots): the
 * // two at the rim share a 1 ft hexagon, so this is 2
 * const shots = [
 *   { x_legacy: 0, y_legacy: 0 },
 *   { x_legacy: -1, y_legacy: 7 },
 *   { x_legacy: -44, y_legacy: 252 },
 * ];
 * hexbin(shots, { radius: 10, x: (s) => s.x_legacy, y: (s) => s.y_legacy }).length;
 * ```
 */
export function hexbin<T>(
  points: readonly T[],
  o: { radius: number; x: (p: T) => number; y: (p: T) => number },
): BinOf<T>[] {
  if (!(Number.isFinite(o.radius) && o.radius > 0))
    throw new InputError(`hexbin radius must be a finite number > 0, got ${String(o.radius)}`);
  const dx = o.radius * 2 * Math.sin(THIRD_PI);
  const dy = o.radius * 1.5;
  const byId = new Map<string, BinOf<T>>();
  const bins: BinOf<T>[] = [];
  for (const p of points) {
    let px = +o.x(p);
    let py = +o.y(p);
    if (Number.isNaN(px) || Number.isNaN(py)) continue;
    py = py / dy;
    let pj = Math.round(py);
    px = px / dx - (pj & 1) / 2;
    let pi = Math.round(px);
    const py1 = py - pj;
    if (Math.abs(py1) * 3 > 1) {
      const px1 = px - pi;
      const pi2 = pi + (px < pi ? -1 : 1) / 2;
      const pj2 = pj + (py < pj ? -1 : 1);
      const px2 = px - pi2;
      const py2 = py - pj2;
      if (px1 * px1 + py1 * py1 > px2 * px2 + py2 * py2) {
        pi = pi2 + (pj & 1 ? 1 : -1) / 2;
        pj = pj2;
      }
    }
    const id = `${pi}-${pj}`;
    let bin = byId.get(id);
    if (bin === undefined) {
      bin = Object.assign([] as T[], { x: (pi + (pj & 1) / 2) * dx || 0, y: pj * dy || 0 });
      byId.set(id, bin);
      bins.push(bin);
    }
    bin.push(p);
  }
  return bins;
}

/** The six vertices of a pointy-top hexagon of circumradius `r` around (0, 0), d3-hexbin's order. */
export function hexagonPoints(r: number): [number, number][] {
  return ANGLES.map((a): [number, number] => [Math.sin(a) * r, -Math.cos(a) * r]);
}

/**
 * An SVG path for a hexagon of circumradius `r` centred on the current point, byte-identical to d3-hexbin's
 * `hexbin.hexagon(r)`: `selection.attr("transform", translate(cx, cy)).attr("d", hexagonPath(r))`.
 *
 * @example
 * ```ts
 * import { hexagonPath } from "@sportsdataverse/sdvplot/bins";
 *
 * hexagonPath(10);
 * ```
 */
export function hexagonPath(r: number): string {
  let x0 = 0;
  let y0 = 0;
  const steps = ANGLES.map((a) => {
    const x1 = Math.sin(a) * r;
    const y1 = -Math.cos(a) * r;
    const step = `${x1 - x0},${y1 - y0}`;
    x0 = x1;
    y0 = y1;
    return step;
  });
  return `m${steps.join("l")}z`;
}
