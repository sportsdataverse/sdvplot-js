import { expect, test } from "vitest";
import { createCircle, createRectangle, createXShape } from "../src/shapes.js";
test("createCircle matches R seq(start*pi, end*pi, length.out = npoints)", () => {
  const c = createCircle({ r: 1, start: 0, end: 2, npoints: 5 });
  expect(c).toHaveLength(5);
  expect(c[0]).toEqual([1, 0]);
  expect(c[4]?.[0]).toBeCloseTo(1, 12);
  expect(c[2]?.[0]).toBeCloseTo(-1, 12);
  const half = createCircle({ r: 6, start: 0.5, end: 1.5, npoints: 3 });
  expect(half[0]?.[0]).toBeCloseTo(0, 12);
  expect(half[1]).toEqual([-6, expect.closeTo(0, 12)]);
});
test("rectangle is a closed 5-point outline; X shape has 14 points", () => {
  expect(createRectangle(0, 1, 0, 2)).toEqual([
    [0, 0],
    [1, 0],
    [1, 2],
    [0, 2],
    [0, 0],
  ]);
  expect(createXShape(2, 0.5)).toHaveLength(14);
});
