// hexbin() and hexagonPath() port d3-hexbin 0.2.2 src/hexbin.js:1-2, :23-72 (Copyright 2012-2016 Mike Bostock,
// BSD-3-Clause; full notice in NOTICE.md). Same lattice, bin order and centres, so bins equal d3-hexbin's.
import { InputError } from "../errors.js";

const THIRD_PI = Math.PI / 3;
const ANGLES = [0, THIRD_PI, 2 * THIRD_PI, 3 * THIRD_PI, 4 * THIRD_PI, 5 * THIRD_PI];

/** One hexagonal bin: the points in it, plus its centre in the points' own units. */
export type HexBinOf<T> = T[] & { x: number; y: number };

/**
 * Bin points into pointy-top hexagons of circumradius `radius`, in the points' OWN units (data space, not
 * pixels). Points with a NaN coordinate are skipped. Centres of `-0` are folded to `0` (blazing-the-nets
 * `main` `lib/data/aggregate.ts:101`), so equal hexes share one key.
 *
 * @example
 * ```ts
 * import { hexbin } from "@sportsdataverse/sdvplot/shots";
 *
 * hexbin([{ x: 0, y: 0 }, { x: 3, y: 4 }], { radius: 10, x: (p) => p.x, y: (p) => p.y }).length;
 * ```
 */
export function hexbin<T>(
  points: readonly T[],
  o: { radius: number; x: (p: T) => number; y: (p: T) => number },
): HexBinOf<T>[] {
  if (!(o.radius > 0)) throw new InputError(`hexbin radius must be > 0, got ${String(o.radius)}`);
  const dx = o.radius * 2 * Math.sin(THIRD_PI);
  const dy = o.radius * 1.5;
  const byId = new Map<string, HexBinOf<T>>();
  const bins: HexBinOf<T>[] = [];
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
 * import { hexagonPath } from "@sportsdataverse/sdvplot/shots";
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
