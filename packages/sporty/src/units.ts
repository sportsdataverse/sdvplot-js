import { UnknownUnitError } from "./errors.js";
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

/** R `convert_units` also accepts the full names (plus singular and British spellings here). */
const UNIT_NAMES: Readonly<Record<string, Units>> = {
  feet: "ft",
  foot: "ft",
  meters: "m",
  metres: "m",
  meter: "m",
  metre: "m",
  yards: "yd",
  yard: "yd",
  inches: "in",
  inch: "in",
  centimeters: "cm",
  centimetres: "cm",
  centimeter: "cm",
  centimetre: "cm",
  millimeters: "mm",
  millimetres: "mm",
  millimeter: "mm",
  millimetre: "mm",
};

/** Case-insensitive unit abbreviation or full name (`"FT"`, `"feet"`, `"Metres"`) to its `Units`; anything else throws `UnknownUnitError`. */
export function normalizeUnit(u: string): Units {
  const k = String(u).toLowerCase();
  if (Object.hasOwn(FT_PER_UNIT, k)) return k as Units;
  if (Object.hasOwn(UNIT_NAMES, k)) return UNIT_NAMES[k] as Units;
  throw new UnknownUnitError(
    `Unknown unit "${u}"; expected one of: ${Object.keys(FT_PER_UNIT).join(", ")} (or a full name such as "feet")`,
  );
}

const convert = (v: number, from: Units, to: Units): number =>
  from === to ? v : (v * FT_PER_UNIT[from]) / FT_PER_UNIT[to];

export const convertUnits = (value: number, from: Units, to: Units): number =>
  convert(value, normalizeUnit(from), normalizeUnit(to));

export function convertPoints(pts: readonly Point[], from: Units, to: Units): Point[] {
  const f = normalizeUnit(from);
  const t = normalizeUnit(to);
  return pts.map(([x, y]): Point => [convert(x, f, t), convert(y, f, t)]);
}
