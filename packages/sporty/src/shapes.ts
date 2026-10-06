import type { Point } from "./scene.js";
import { rotateCoords } from "./transform.js";

/** Angles `start`/`end` are in units of π, like R. */
export function createCircle({
  center = [0, 0],
  npoints = 1000,
  r = 1,
  start = 0,
  end = 2,
}: { center?: Point; npoints?: number; r?: number; start?: number; end?: number } = {}): Point[] {
  const out: Point[] = [];
  const a0 = start * Math.PI;
  const a1 = end * Math.PI;
  for (let i = 0; i < npoints; i++) {
    const t = npoints === 1 ? a0 : a0 + ((a1 - a0) * i) / (npoints - 1);
    out.push([center[0] + r * Math.cos(t), center[1] + r * Math.sin(t)]);
  }
  return out;
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
