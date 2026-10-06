import type { Color, Point } from "./scene.js";

export function rotateCoords(pts: readonly Point[], angleDeg: number): Point[] {
  if (angleDeg === 0) return pts.map((p): Point => [p[0], p[1]]);
  const t = (angleDeg / 180) * Math.PI;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return pts.map(([x, y]): Point => [x * c - y * s, x * s + y * c]);
}

export const reflectCoords = (
  pts: readonly Point[],
  { overX = false, overY = true }: { overX?: boolean; overY?: boolean },
): Point[] => pts.map(([x, y]): Point => [overY ? -x : x, overX ? -y : y]);

export interface Placement {
  xAnchor: number;
  yAnchor: number;
  reflectX?: boolean;
  reflectY?: boolean;
  xTrans?: number;
  yTrans?: number;
  rotation?: number;
}

/** R `add_feature`: 1/2/4 copies — (x+ax, y+ay), (−(x+ax), y+ay), (−(x+ax), −(y+ay)), (x+ax, −(y+ay)) — then + shift, then rotate about (0,0). */
export function placeFeature(points: readonly Point[], p: Placement): Point[][] {
  const { xAnchor: ax, yAnchor: ay, xTrans: tx = 0, yTrans: ty = 0, rotation = 0 } = p;
  const d1 = points.map(([x, y]): Point => [x + ax + tx, y + ay + ty]);
  const d2 = points.map(([x, y]): Point => [-(x + ax) + tx, y + ay + ty]);
  const d3 = points.map(([x, y]): Point => [-(x + ax) + tx, -(y + ay) + ty]);
  const d4 = points.map(([x, y]): Point => [x + ax + tx, -(y + ay) + ty]);
  const copies =
    p.reflectX && p.reflectY ? [d1, d2, d3, d4] : p.reflectX ? [d1, d2] : p.reflectY ? [d1, d4] : [d1];
  return copies.map((c) => rotateCoords(c, rotation));
}

/** R: 9-char hex with alpha not 00/ff → NA (no stroke); "#ffffff00" → undefined. */
export function strokeFor(outline: Color | undefined): Color | undefined {
  if (!outline) return undefined;
  const o = outline.toLowerCase();
  if (/^#[0-9a-f]{8}$/.test(o)) {
    const a = o.slice(7);
    return a === "ff" ? o.slice(0, 7) : undefined;
  }
  return o;
}
