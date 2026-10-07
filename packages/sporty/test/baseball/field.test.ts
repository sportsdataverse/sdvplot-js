import { expect, test } from "vitest";
import { baseballField } from "../../src/baseball/field.js";

test("MLB: origin home_plate, background #395d33, 14 polygons in R order, asymmetric bbox", () => {
  const s = baseballField("mlb");
  expect(s.origin).toBe("home_plate");
  expect(s.units).toBe("ft");
  expect(s.background).toBe("#395d33");
  expect(s.bbox).toEqual([
    expect.closeTo(355 * Math.cos((3 * Math.PI) / 4), 9),
    -65,
    expect.closeTo(355 * Math.cos(Math.PI / 4), 9),
    405,
  ]);
  const polys = s.features.filter((f) => f.kind === "polygon");
  expect(polys.map((f) => f.name)).toEqual([
    "infield_dirt",
    "infield_grass",
    "pitchers_mound",
    "home_plate",
    "base",
    "base",
    "base",
    "pitchers_plate",
    "batters_box",
    "batters_box",
    "catchers_box",
    "foul_line",
    "foul_line",
    "running_lane",
  ]);
  expect(polys[3]!.fill).toBe("#ffffff");
  expect(polys[5]!.points.every(([, y]) => Math.abs(y - 90 * Math.SQRT2) < 1.25)).toBe(true);
});

test("display range infield; little league trapezoid catcher's box; pony has no running-lane params (all 0 → degenerate 7-point polygon still emitted)", () => {
  expect(baseballField("mlb", { displayRange: "infield" }).bbox).toEqual([-100, -18, 100, 160.5]);
  expect(
    baseballField("little league")
      .features.filter((f) => f.kind === "polygon")
      .find((f) => f.name === "catchers_box")!.points,
  ).toHaveLength(9);
  expect(baseballField("pony").features.filter((f) => f.name === "running_lane")).toHaveLength(1);
});

test("rotation and translation of an off-centre bbox (Review Focus 2)", () => {
  const r = baseballField("mlb", { rotation: 90 });
  expect(r.bbox).toEqual([
    expect.closeTo(-405, 9),
    expect.closeTo(-251.0229, 3),
    expect.closeTo(65, 9),
    expect.closeTo(251.0229, 3),
  ]);
  const t = baseballField("mlb", { xTrans: 10, yTrans: -20 });
  expect(t.bbox[1]).toBe(-85);
  expect(t.bbox[3]).toBe(385);
  expect(() => baseballField("mlb", { displayRange: "outfield" as never })).toThrow(/display range/);
});

test("background can be hidden; units conversion to metres converts bbox and points", () => {
  expect(baseballField("mlb", { colorUpdates: { plot_background: "#00000000" } }).background).toBeUndefined();
  const m = baseballField("mlb", { units: "m" });
  expect(m.bbox[3]).toBeCloseTo(405 * 0.3048, 9);
  expect(m.units).toBe("m");
});
