import type { Point } from "./scene.js";
import { rotateCoords } from "./transform.js";

/** R `cospi()`: exact at the multiples of 0.5. */
const cospi = (t: number): number => {
  const x = Math.abs(t) % 2;
  if (x % 1 === 0.5) return 0;
  if (x === 1) return -1;
  if (x === 0) return 1;
  return Math.cos(Math.PI * x);
};

/** R `sinpi()`: exact at the multiples of 0.5. */
const sinpi = (t: number): number => {
  let x = t % 2;
  if (x <= -1) x += 2;
  else if (x > 1) x -= 2;
  if (x === 0 || x === 1) return 0;
  if (x === 0.5) return 1;
  if (x === -0.5) return -1;
  return Math.sin(Math.PI * x);
};

/**
 * Angles `start`/`end` are in units of π, like R. As sportyR 2.4.1 (#79), the angles stay in units of π (R `seq()`,
 * whose last value is `end` exactly) and go through `cospi`/`sinpi`, so the quarter points sit exactly on the axes.
 */
export function createCircle({
  center = [0, 0],
  npoints = 1000,
  r = 1,
  start = 0,
  end = 2,
}: { center?: Point; npoints?: number; r?: number; start?: number; end?: number } = {}): Point[] {
  const out: Point[] = [];
  const by = (end - start) / (npoints - 1);
  for (let i = 0; i < npoints; i++) {
    const t = i === 0 ? start : i === npoints - 1 ? end : start + i * by;
    out.push([center[0] + r * cospi(t), center[1] + r * sinpi(t)]);
  }
  return out;
}

/**
 * sportyR `split_rings` (2.4.1, #79): a feature's points split at every return to a ring's first point, after dropping
 * each point that repeats the one before it. A path that never closes is kept as one trailing ring.
 */
export function splitRings(points: readonly Point[], tolerance = 1e-9): Point[][] {
  if (points.length < 2) return [[...points]];
  const pts = points.filter(
    (p, i) =>
      i === 0 ||
      Math.abs(p[0] - (points[i - 1] as Point)[0]) + Math.abs(p[1] - (points[i - 1] as Point)[1]) >=
        tolerance,
  );
  if (pts.length === 1) return [pts];
  const rings: Point[][] = [];
  let start = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i] as Point;
    const [x0, y0] = pts[start] as Point;
    if (i > start && Math.abs(x - x0) < tolerance && Math.abs(y - y0) < tolerance) {
      rings.push(pts.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < pts.length - 1) rings.push(pts.slice(start));
  return rings;
}

/**
 * sportyR `has_area` (2.4.1, #79): true when some ring's unsigned shoelace area exceeds `tolerance`. Like R, an open
 * ring is measured as given (not closed first).
 */
export function hasArea(points: readonly Point[], tolerance = 1e-9): boolean {
  if (points.length < 3) return false;
  return splitRings(points).some((ring) => {
    let s = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i] as Point;
      const [x1, y1] = ring[i + 1] as Point;
      s += x0 * y1 - x1 * y0;
    }
    return Math.abs(s) / 2 > tolerance;
  });
}

export const createRectangle = (xMin: number, xMax: number, yMin: number, yMax: number): Point[] => [
  [xMin, yMin],
  [xMax, yMin],
  [xMax, yMax],
  [xMin, yMax],
  [xMin, yMin],
];

export const createSquare = (side: number, c: Point = [0, 0]): Point[] =>
  createRectangle(c[0] - side / 2, c[0] + side / 2, c[1] - side / 2, c[1] + side / 2);

export const createDiamond = (h: number, w: number, c: Point = [0, 0]): Point[] => [
  [c[0] - w / 2, c[1]],
  [c[0], c[1] - h / 2],
  [c[0] + w / 2, c[1]],
  [c[0], c[1] + h / 2],
  [c[0] - w / 2, c[1]],
];

export function createXShape(barLength: number, barWidth: number, rotationDeg = 45): Point[] {
  const L = barLength;
  const W = barWidth;
  const xs = [0, W / 2, W / 2, L / 2, L / 2, W / 2, W / 2, -W / 2, -W / 2, -L / 2, -L / 2, -W / 2, -W / 2, 0];
  const ys = [
    L / 2,
    L / 2,
    W / 2,
    W / 2,
    -W / 2,
    -W / 2,
    -L / 2,
    -L / 2,
    -W / 2,
    -W / 2,
    W / 2,
    W / 2,
    L / 2,
    L / 2,
  ];
  return rotateCoords(
    xs.map((x, i): Point => [x, ys[i] ?? 0]),
    rotationDeg,
  );
}
