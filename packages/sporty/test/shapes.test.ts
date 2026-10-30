import { expect, test } from "vitest";
import type { Feature, Point } from "../src/scene.js";
import {
  createCircle,
  createRectangle,
  createSquare,
  createXShape,
  hasArea,
  splitRings,
} from "../src/shapes.js";
import { addFeature } from "../src/surface.js";
test("createCircle matches R cospi/sinpi(seq(start, end, length.out = npoints))", () => {
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
test("createCircle puts the quarter points exactly on the axes (R cospi / sinpi, sportyR 2.4.1)", () => {
  const half = createCircle({ r: 15, start: 0.5, end: 1.5, npoints: 101 });
  expect(half[0]).toEqual([0, 15]);
  expect(half[100]).toEqual([0, -15]);
});
test("splitRings and hasArea read back-to-back rings (sportyR 2.4.1)", () => {
  const square = createSquare(2);
  const other = createSquare(2, [5, 0]);
  expect(splitRings([...square, ...other])).toHaveLength(2);
  expect(hasArea([...square, ...other])).toBe(true);
  expect(hasArea([...square, ...[...other].reverse()])).toBe(true); // opposite windings do not cancel
  // a line, a single point and a collapsed rectangle have no area
  expect(
    hasArea([
      [0, 0],
      [1, 0],
      [0, 0],
    ]),
  ).toBe(false);
  expect(hasArea([[0, 0]])).toBe(false);
  expect(
    splitRings([
      [1, 2],
      [1, 2],
      [1, 2],
    ]),
  ).toHaveLength(1);
  expect(
    hasArea([
      [1, 2],
      [1, 2],
      [1, 2],
    ]),
  ).toBe(false);
  expect(hasArea(createRectangle(-100, 100, 0, 0))).toBe(false);
  // a path that never closes is kept as one trailing ring
  expect(
    splitRings([
      [0, 0],
      [1, 0],
      [1, 1],
    ]),
  ).toHaveLength(1);
});
test("addFeature keeps a no-area feature only when its stroke is visible (sportyR 2.4.1)", () => {
  const n = (pts: Point[], stroke: string): number => {
    const out: Feature[] = [];
    addFeature(out, "f", pts, "#123456", { xAnchor: 0, yAnchor: 0 }, { stroke });
    return out.length;
  };
  expect(n(createRectangle(-1, 1, 0, 0), "#ffffff00")).toBe(0);
  expect(n(createRectangle(-1, 1, 0, 0), "#ff0000")).toBe(1);
  expect(n(createSquare(2), "#ffffff00")).toBe(1);
});
