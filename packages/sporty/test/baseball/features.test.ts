import { expect, test } from "vitest";
import { base, homePlate, infieldDirt, quadraticFormula } from "../../src/baseball/features.js";

test("infieldDirt: infield arc radius 95 ft centred on the pitcher's plate, then the home-plate circle; 2·npoints points", () => {
  const pts = infieldDirt({
    homePlateCircleRadius: 13,
    foulLineToFoulGrass: 3,
    pitchersPlateDistance: 60.5,
    infieldArcRadius: 95,
    npoints: 10,
  });
  expect(pts).toHaveLength(20);
  for (const [x, y] of pts.slice(0, 10)) expect(Math.hypot(x, y - 60.5)).toBeCloseTo(95, 9);
  for (const [x, y] of pts.slice(10)) expect(Math.hypot(x, y)).toBeCloseTo(13, 9);
  const [r1, r2] = quadraticFormula(2, -2 * 3 - 2 * 60.5, 3 ** 2 + 2 * 3 * 60.5 + 60.5 ** 2 - 95 ** 2);
  const infieldX = Math.max(r1, r2);
  const start = Math.acos(infieldX / 95) / Math.PI;
  expect(pts[0]![0]).toBeCloseTo(95 * Math.cos(start * Math.PI), 9);
  expect(pts[9]![0]).toBeCloseTo(95 * Math.cos((1 - start) * Math.PI), 9);
});

test("home plate is the 6-point pentagon with its back tip at the origin", () => {
  expect(homePlate({ homePlateEdgeLength: 1.4167 })).toEqual([
    [0, 0],
    [0.70835, 0.70835],
    [0.70835, 1.4167],
    [-0.70835, 1.4167],
    [-0.70835, 0.70835],
    [0, 0],
  ]);
});

test("base is a 45°-rotated square, shifted by side·√2/2 for 1B (left) / 3B (right)", () => {
  const first = base({ baseSideLength: 1.25, adjustXLeft: true });
  const third = base({ baseSideLength: 1.25, adjustXRight: true });
  const second = base({ baseSideLength: 1.25 });
  expect(second[0]![0]).toBeCloseTo(0, 12);
  expect(second[0]![1]).toBeCloseTo(-1.25 / Math.SQRT2, 12);
  expect(first.map((p) => p[0])).toEqual(
    second.map((p) => expect.closeTo(p[0] - (1.25 * Math.SQRT2) / 2, 12)),
  );
  expect(third.map((p) => p[0])).toEqual(
    second.map((p) => expect.closeTo(p[0] + (1.25 * Math.SQRT2) / 2, 12)),
  );
});
