import type { Point, Units } from "./scene.js";

/** Feet per one unit (R `unit-conversions.R`; NOT sportypy's 340.8 bug). */
export const FT_PER_UNIT: Readonly<Record<Units, number>> = {
  mm: 1 / 304.8,
  cm: 1 / 30.48,
  m: 1 / 0.3048,
  in: 1 / 12,
  ft: 1,
  yd: 3,
};

export const convertUnits = (value: number, from: Units, to: Units): number =>
  from === to ? value : (value * FT_PER_UNIT[from]) / FT_PER_UNIT[to];

export const convertPoints = (pts: readonly Point[], from: Units, to: Units): Point[] =>
  pts.map(([x, y]): Point => [convertUnits(x, from, to), convertUnits(y, from, to)]);
