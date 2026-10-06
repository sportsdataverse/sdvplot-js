import { expect, test } from "vitest";
import { centerCircleOutline, divisionLine, threePointLine } from "../../src/basketball/features.js";

test("centerCircleOutline = outer half arc (0.5π→1.5π) then inner arc back (1.5π→0.5π)", () => {
  const pts = centerCircleOutline({ centerCircleRadius: 6, lineThickness: 0.1667, npoints: 4 });
  expect(pts).toHaveLength(8);
  expect(pts[0]![0]).toBeCloseTo(0, 10);
  expect(pts[0]![1]).toBeCloseTo(6, 10);
  expect(pts[4]![0]).toBeCloseTo(0, 10);
  expect(pts[4]![1]).toBeCloseTo(-(6 - 0.1667), 10);
});

test("threePointLine starts at the corner point and closes back on it", () => {
  const pts = threePointLine({
    basketCenterToBaseline: 5.25,
    basketCenterToCornerThree: 22,
    lineThickness: 0.1667,
    threePointLineRadius: 23.75,
    npoints: 50,
  });
  expect(pts[0]).toEqual([5.25, 22]);
  expect(pts.at(-1)).toEqual([5.25, 22]);
  const a = Math.asin(22 / 23.75) / Math.PI;
  expect(pts[1]![0]).toBeCloseTo(23.75 * Math.cos((1 - a) * Math.PI), 10);
});

test("divisionLine with extension shifts both ends down by extension + thickness (R quirk preserved)", () => {
  expect(divisionLine({ courtWidth: 50, lineThickness: 0.1667, divisionLineExtension: 2 })).toEqual([
    [-0.08335, -27.1667],
    [0.08335, -27.1667],
    [0.08335, 22.8333],
    [-0.08335, 22.8333],
    [-0.08335, -27.1667],
  ]);
});
