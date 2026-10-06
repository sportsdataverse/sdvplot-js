import type { Color, Feature, Point, Scene, TextFeature, Units } from "./scene.js";
import { createRectangle } from "./shapes.js";
import { asArray } from "./specs/_normalize.js";
import { type Placement, placeFeature, rotateCoords, strokeFor } from "./transform.js";
import { convertPoints, convertUnits } from "./units.js";

export { SportyError, UnknownDisplayRangeError, UnknownLeagueError, UnknownUnitError } from "./errors.js";

type Limits = readonly [number, number];
const isMatrix = (v: unknown): boolean => Array.isArray(v) && Array.isArray(v[0]);

/**
 * R `utils::modifyList(base, updates)`; a scalar update to an array field becomes `[value]`, a flat row to a matrix
 * field `[row]`. An `undefined`/`null` update keeps the default.
 */
export function mergeParams<P extends object>(
  base: P,
  updates: Partial<Record<keyof P, unknown>> | undefined,
  arrayFields: readonly (keyof P)[],
): P {
  const out: Record<keyof P, unknown> = { ...base };
  for (const k of Object.keys(updates ?? {}) as (keyof P)[]) {
    const v = updates?.[k];
    if (v === undefined || v === null) continue;
    const w = arrayFields.includes(k) ? asArray(v) : v;
    out[k] = isMatrix(base[k]) && !isMatrix(w) ? [w] : w;
  }
  return out as P;
}

/** R `utils::modifyList(<set_colors()>, color_updates)`; an `undefined`/`null` colour keeps the default (as `mergeParams`). */
export function mergeColors<F extends string>(
  defaults: Readonly<Record<F, Color>>,
  updates?: Partial<Record<F, Color | readonly Color[]>>,
): Record<F, Color | readonly Color[]> {
  const out: Record<F, Color | readonly Color[]> = { ...defaults };
  for (const k of Object.keys(updates ?? {}) as F[]) {
    const v = updates?.[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

/** R `data.frame()` recycling: colour i of a vector is `c[i % length]`. */
export const colorAt = (c: Color | readonly Color[], i: number): Color =>
  typeof c === "string" ? c : (c[i % c.length] ?? "#00000000");

export interface FeatureOptions {
  /** R `feature_outline_color` (default `#ffffff00` = no stroke). */
  stroke?: Color;
  /** Convert the points AND anchors before placement (R converts points only; see `convertLimits`). */
  units?: readonly [from: Units, to: Units];
  /** 3-D hints, already in the Scene's units. */
  elevation?: number;
  height?: number;
}

/** R `add_feature`: one PolygonFeature per placed copy, zIndex = position in `features` (= R's layer index). */
export function addFeature(
  features: Feature[],
  name: string,
  points: readonly Point[],
  fill: Color,
  placement: Placement,
  { stroke, units, elevation, height }: FeatureOptions = {},
): void {
  const [from, to] = units ?? ["ft", "ft"];
  const p = {
    ...placement,
    xAnchor: convertUnits(placement.xAnchor, from, to),
    yAnchor: convertUnits(placement.yAnchor, from, to),
  };
  const s = strokeFor(stroke);
  for (const copy of placeFeature(convertPoints(points, from, to), p)) {
    features.push({
      kind: "polygon",
      name,
      zIndex: features.length,
      fill,
      points: copy,
      ...(s === undefined ? {} : { stroke: s }),
      ...(elevation === undefined ? {} : { elevation }),
      ...(height === undefined ? {} : { height }),
    });
  }
}

/** R `vec %or% d`: an empty vector becomes the length-1 default. */
export const orVec = <T>(v: readonly T[] | undefined, d: T): readonly T[] =>
  v !== undefined && v.length > 0 ? v : [d];

/** R `data.frame()`: every column is recycled to the longest one. */
export function frame<T extends Record<string, readonly unknown[]>>(
  cols: T,
): { [K in keyof T]: T[K][number] }[] {
  const n = Math.max(...Object.values(cols).map((c) => c.length));
  return Array.from(
    { length: n },
    (_, i) =>
      Object.fromEntries(Object.entries(cols).map(([k, c]) => [k, c[i % c.length]])) as {
        [K in keyof T]: T[K][number];
      },
  );
}

/** A ggfittext label, already placed (R positions it directly, not via `add_feature`); zIndex = position in `features`. */
export function addText(
  features: Feature[],
  name: string,
  t: Omit<TextFeature, "kind" | "name" | "zIndex">,
): void {
  features.push({ kind: "text", name, zIndex: features.length, ...t });
}

/** R `geom_*` tail: rotate the corners of the xlims × ylims box, then take min/max. */
export function displayBbox(xlim: Limits, ylim: Limits, rotation: number): Scene["bbox"] {
  const box = rotateCoords(
    createRectangle(Math.min(...xlim), Math.max(...xlim), Math.min(...ylim), Math.max(...ylim)),
    rotation,
  );
  const xs = box.map((q) => q[0]);
  const ys = box.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * Divergence from R: R converts the feature points but neither the anchors nor the display limits, so its
 * non-native plot is scrambled as well as cropped. We convert all three (see `addFeature`).
 */
export const convertLimits = (
  xlim: Limits,
  ylim: Limits,
  from: Units,
  to: Units,
): [x: [number, number], y: [number, number]] => [
  [convertUnits(xlim[0], from, to), convertUnits(xlim[1], from, to)],
  [convertUnits(ylim[0], from, to), convertUnits(ylim[1], from, to)],
];
