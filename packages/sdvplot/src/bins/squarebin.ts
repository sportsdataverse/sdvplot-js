// squarebin() is the square twin of hexbin(): the same bin record (BinOf), first-seen order, NaN skipped, -0
// folded. binner() picks either lattice from one plain options object, so everything downstream of the bins is
// shape-agnostic (spec J38).
import { InputError } from "../errors.js";
import { type BinOf, hexagonPath, hexagonPoints, hexbin } from "./hexbin.js";

/** The cell shape of a lattice. */
export type BinShape = "hex" | "square";

/**
 * A cell lattice as plain JSON: pointy-top hexagons of circumradius `radius` (d3-hexbin's), squares of side `side`,
 * or (`equalArea: true`) the square with the same area as a hexagon of circumradius `radius`.
 */
export type BinnerOptions =
  | { readonly shape?: "hex"; readonly radius: number }
  | { readonly shape: "square"; readonly side: number }
  | { readonly shape: "square"; readonly radius: number; readonly equalArea: true };

/** A lattice with `equalArea` resolved: what an index stores so a later binning reproduces the same cells. */
export type Lattice =
  | { readonly shape?: "hex"; readonly radius: number }
  | { readonly shape: "square"; readonly side: number };

/** One lattice, either shape. */
export interface Binner {
  /** `"hex"` or `"square"`. */
  readonly shape: BinShape;
  /** The full cell size in the points' units: the hexagon's circumradius, or the square's side. */
  readonly size: number;
  /** The resolved options: `{ radius }` for hexagons, `{ shape: "square", side }` for squares. */
  readonly lattice: Lattice;
  /** Bin points (`hexbin` or `squarebin`). */
  bins<T>(points: readonly T[], o: { x: (p: T) => number; y: (p: T) => number }): BinOf<T>[];
  /** An SVG path for one cell of size `s` (default `size`) centred on the current point. */
  cell(s?: number): string;
}

/** The option the caller passed, if it is a positive finite number; otherwise an InputError naming it. */
function positive(name: "radius" | "side", v: number): number {
  if (!(Number.isFinite(v) && v > 0))
    throw new InputError(`binner ${name} must be a finite number > 0, got ${String(v)}`);
  return v;
}

/** √(3√3/2) ≈ 1.6119: a hexagon of circumradius r has area (3√3/2)·r², so the equal-area square has side r·√(3√3/2). */
const EQUAL_AREA = Math.sqrt(1.5 * Math.sqrt(3));

/**
 * Bin points into axis-aligned squares of side `side`, in the points' OWN units. As in d3-hexbin's lattice, a cell
 * is centred on the origin, so centres are `(i·side, j·side)`. Cells are half-open, `[c − side/2, c + side/2)` on
 * each axis: a point exactly on an edge goes to the higher cell, because the cell index is `Math.round(x / side)`,
 * the rounding d3-hexbin uses (`hexbin.js:33-34`). Bins come out in first-seen order; points with a NaN coordinate
 * are skipped; centres of `-0` fold to `0`. Throws `InputError` unless `side` is a finite number greater than 0.
 *
 * @example
 * ```ts
 * import { squarebin } from "@sportsdataverse/sdvplot/bins";
 *
 * // three Brooklyn shots of 2025-26 (sportsdataverse-data nba_stats_shots); x = 5 sits on a cell edge and goes to
 * // the higher cell: [[0, 0, 1], [0, 10, 1], [10, 90, 1]]
 * const shots = [
 *   { x_legacy: 0, y_legacy: 0 },
 *   { x_legacy: -1, y_legacy: 7 },
 *   { x_legacy: 5, y_legacy: 91 },
 * ];
 * squarebin(shots, { side: 10, x: (s) => s.x_legacy, y: (s) => s.y_legacy }).map((b) => [b.x, b.y, b.length]);
 * ```
 */
export function squarebin<T>(
  points: readonly T[],
  o: { side: number; x: (p: T) => number; y: (p: T) => number },
): BinOf<T>[] {
  const s = o.side;
  if (!(Number.isFinite(s) && s > 0))
    throw new InputError(`squarebin side must be a finite number > 0, got ${String(s)}`);
  const byId = new Map<string, BinOf<T>>();
  const bins: BinOf<T>[] = [];
  for (const p of points) {
    const px = +o.x(p);
    const py = +o.y(p);
    if (Number.isNaN(px) || Number.isNaN(py)) continue;
    const i = Math.round(px / s);
    const j = Math.round(py / s);
    const id = `${i}-${j}`;
    let bin = byId.get(id);
    if (bin === undefined) {
      bin = Object.assign([] as T[], { x: i * s || 0, y: j * s || 0 });
      byId.set(id, bin);
      bins.push(bin);
    }
    bin.push(p);
  }
  return bins;
}

/** The four corners of a square of side `s` around (0, 0), in the same turning order as `hexagonPoints`. */
export function squarePoints(s: number): [number, number][] {
  const h = s / 2;
  return [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
}

/**
 * An SVG path for a square of side `s` centred on the current point, drawn the way `hexagonPath` is:
 * `selection.attr("transform", translate(cx, cy)).attr("d", squarePath(s))`.
 *
 * @example
 * ```ts
 * import { squarePath } from "@sportsdataverse/sdvplot/bins";
 *
 * squarePath(10); // "m-5,-5h10v10h-10z"
 * ```
 */
export function squarePath(s: number): string {
  return `m${-s / 2},${-s / 2}h${s}v${s}h${-s}z`;
}

/**
 * A cell's vertices around (0, 0), in the points' units: a hexagon of circumradius `size` (d3-hexbin's vertex
 * order) or a square of side `size`. Add a bin's centre to each to outline that cell as a polygon.
 *
 * @example
 * ```ts
 * import { cellPoints } from "@sportsdataverse/sdvplot/bins";
 *
 * cellPoints("square", 10); // [[-5, -5], [5, -5], [5, 5], [-5, 5]]
 * ```
 */
export function cellPoints(shape: BinShape, size: number): [number, number][] {
  return shape === "square" ? squarePoints(size) : hexagonPoints(size);
}
/**
 * A cell's relative SVG path, `hexagonPath(size)` or `squarePath(size)`, drawn with a `translate` to each bin centre.
 *
 * @example
 * ```ts
 * import { cellPath } from "@sportsdataverse/sdvplot/bins";
 *
 * cellPath("square", 10); // "m-5,-5h10v10h-10z"
 * ```
 */
export function cellPath(shape: BinShape, size: number): string {
  return shape === "square" ? squarePath(size) : hexagonPath(size);
}

/**
 * One binning API for both lattices: `binner({ radius: 15 })` is d3-hexbin's, `binner({ shape: "square", side: 15 })`
 * squares, and `binner({ shape: "square", radius: 15, equalArea: true })` squares of side 15·√(3√3/2) ≈ 24.18,
 * each the area of a radius-15 hexagon. Works on any x/y data, not just shots. Throws `InputError` on an unknown
 * `shape` or a size that is not a positive finite number, naming the option passed.
 *
 * @example
 * ```ts
 * import { binner } from "@sportsdataverse/sdvplot/bins";
 *
 * const b = binner({ shape: "square", radius: 10, equalArea: true }); // side 16.1185…: a radius-10 hexagon's area
 * // three Brooklyn shots of 2025-26 (sportsdataverse-data nba_stats_shots): the two at the rim share a square
 * const shots = [
 *   { x_legacy: 0, y_legacy: 0 },
 *   { x_legacy: -1, y_legacy: 7 },
 *   { x_legacy: -44, y_legacy: 252 },
 * ];
 * b.bins(shots, { x: (s) => s.x_legacy, y: (s) => s.y_legacy }).map((c) => [c.x, c.y, c.length]);
 * ```
 */
export function binner(o: BinnerOptions): Binner {
  // Runtime checks for JS callers: the types already rule these out.
  const shape: unknown = o.shape;
  if (shape !== undefined && shape !== "hex" && shape !== "square")
    throw new InputError(`binner shape must be "hex" or "square", got ${String(shape)}`);
  if (o.shape !== "square") {
    const radius = positive("radius", o.radius);
    return {
      shape: "hex",
      size: radius,
      lattice: { radius },
      bins: (points, a) => hexbin(points, { radius, x: a.x, y: a.y }),
      cell: (s = radius) => hexagonPath(s),
    };
  }
  if (!("side" in o) && o.equalArea !== true)
    throw new InputError("binner square needs side, or radius with equalArea: true");
  const side = "side" in o ? positive("side", o.side) : positive("radius", o.radius) * EQUAL_AREA;
  return {
    shape: "square",
    size: side,
    lattice: { shape: "square", side },
    bins: (points, a) => squarebin(points, { side, x: a.x, y: a.y }),
    cell: (s = side) => squarePath(s),
  };
}
