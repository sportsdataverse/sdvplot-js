import { expect, test } from "vitest";
import { surface } from "../../src/api.js";
import { softballField } from "../../src/softball/field.js";

const S = Math.SQRT1_2;

test("NCAA: origin home_plate, background #395d33, 17 polygons in R's layer order, bbox from the fences", () => {
  const s = softballField("ncaa");
  expect(s.sport).toBe("softball");
  expect(s.origin).toBe("home_plate");
  expect(s.units).toBe("ft");
  expect(s.background).toBe("#395d33");
  // geom-softball.R: x = 190·cos(3π/4) .. 190·cos(π/4); y = -(backstop 25 + 5) .. centre field 220 + 5
  expect(s.bbox).toEqual([expect.closeTo(-190 * S, 9), -30, expect.closeTo(190 * S, 9), 225]);
  const polys = s.features.filter((f) => f.kind === "polygon");
  expect(polys.map((f) => f.name)).toEqual([
    "infield_dirt",
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
    "pitchers_circle",
    "pitchers_lane",
    "pitchers_lane",
    "coaches_box",
    "coaches_box",
  ]);
  expect(polys[0]!.fill).toBe("#9b7653");
  // second base sits at 60·√2 on the y axis
  expect(polys[3]!.points.every(([x, y]) => Math.abs(x) < 1 && Math.abs(y - 60 * Math.SQRT2) < 1)).toBe(true);
});

test("pitcher's circle: 8 ft ring about the plate's front edge (43 ft), outer then inner (radius 7.75)", () => {
  const ring = softballField("ncaa", { arcResolution: 100 }).features.find(
    (f) => f.name === "pitchers_circle",
  )!;
  expect(ring.kind).toBe("polygon");
  const pts = ring.kind === "polygon" ? ring.points : [];
  expect(pts).toHaveLength(200);
  expect(pts[0]![0]).toBeCloseTo(8, 9);
  expect(pts[0]![1]).toBeCloseTo(43, 9);
  expect(pts[100]![0]).toBeCloseTo(7.75, 9);
});

test("display range infield; unknown range throws; units convert points, anchors and limits (as R does for softball)", () => {
  expect(softballField("ncaa", { displayRange: "infield" }).bbox).toEqual([-65, -18, 65, 108]);
  expect(() => softballField("ncaa", { displayRange: "outfield" as never })).toThrow(/display range/);
  const m = softballField("ncaa", { units: "m" });
  expect(m.units).toBe("m");
  expect(m.bbox[3]).toBeCloseTo(225 * 0.3048, 9);
  const base2 = m.features.filter((f) => f.name === "base")[1]!;
  expect(
    base2.kind === "polygon" && base2.points.every(([, y]) => Math.abs(y - 60 * Math.SQRT2 * 0.3048) < 0.3),
  ).toBe(true);
  expect(() => softballField("mlb")).toThrow(/Unknown softball league/);
});

test("surface('softball', …) dispatches; colour updates apply; custom builds from zeros (and draws nothing)", () => {
  const s = surface("softball", "NCAA", { colorUpdates: { pitchers_circle: "#ff0000" } });
  expect(s.league).toBe("ncaa");
  expect(s.features.find((f) => f.name === "pitchers_circle")!.fill).toBe("#ff0000");
  // every all-zero feature has no area and no stroke, so sportyR 2.4.1 draws none of the 17
  expect(softballField("custom").features).toEqual([]);
});
