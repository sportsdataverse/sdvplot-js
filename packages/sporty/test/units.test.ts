import { expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import { UnknownUnitError } from "../src/errors.js";
import { footballField } from "../src/football/field.js";
import { hockeyRink } from "../src/hockey/rink.js";
import type { Units } from "../src/scene.js";
import { convertPoints, convertUnits, normalizeUnit } from "../src/units.js";

test("ft↔m↔yd↔mm (R factors)", () => {
  expect(convertUnits(1, "ft", "m")).toBeCloseTo(0.3048, 12);
  expect(convertUnits(1, "yd", "ft")).toBe(3);
  expect(convertUnits(304.8, "mm", "ft")).toBeCloseTo(1, 12);
  expect(convertUnits(94, "ft", "ft")).toBe(94);
});

test("units are case-insensitive and accept R's full names; anything else throws UnknownUnitError", () => {
  for (const [loose, unit] of [
    ["FT", "ft"],
    ["feet", "ft"],
    ["Foot", "ft"],
    ["M", "m"],
    ["metres", "m"],
    ["Meters", "m"],
    ["yards", "yd"],
    ["inch", "in"],
    ["centimetres", "cm"],
    ["millimeters", "mm"],
  ] as const)
    expect(normalizeUnit(loose)).toBe(unit);
  expect(convertUnits(1, "FEET" as Units, "Meters" as Units)).toBe(convertUnits(1, "ft", "m"));
  expect(convertPoints([[3, 6]], "yards" as Units, "ft")).toEqual([[9, 18]]);
  expect(() => normalizeUnit("furlong")).toThrow(UnknownUnitError);
  expect(() => normalizeUnit("constructor")).toThrow("expected one of: mm, cm, m, in, ft, yd");
  expect(() => convertUnits(1, "furlong" as Units, "ft")).toThrow(UnknownUnitError);
});

test("assemblers normalise `units` (no silent NaN scene)", () => {
  for (const build of [basketballCourt, hockeyRink, footballField] as ((
    l: string,
    o?: { units?: Units },
  ) => ReturnType<typeof basketballCourt>)[]) {
    const ft = build("ncaa", { units: "ft" });
    const m = build("ncaa", { units: "m" });
    expect(build("ncaa", { units: "FT" as Units })).toEqual(ft);
    expect(build("ncaa", { units: "feet" as Units })).toEqual(ft);
    const loose = build("ncaa", { units: "M" as Units });
    expect(loose).toEqual(m);
    expect(loose.units).toBe("m");
    expect(loose.bbox.every(Number.isFinite)).toBe(true);
    expect(() => build("ncaa", { units: "furlong" as Units })).toThrow(UnknownUnitError);
  }
});
