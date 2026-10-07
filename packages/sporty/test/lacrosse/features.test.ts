import { expect, test } from "vitest";
import {
  boards,
  faceOffMarker,
  fieldApron,
  goalArc,
  goalCircle,
  neutralZone,
} from "../../src/lacrosse/features.js";
test("goalCircle full-360 is two mirrored half rings (2·(2n+5) points); clipped variant starts at acos(depth/r)", () => {
  const full = goalCircle({
    goalCircleRadius: 3,
    lineThickness: 0.1111,
    goalCircleFull360: true,
    npoints: 10,
  });
  expect(full).toHaveLength(2 * (2 * 10 + 5));
  expect(full[0]).toEqual([0, 3]);
  expect(full[25]![0]).toBeCloseTo(-0, 12);
  expect(full[25]![1]).toBeCloseTo(3, 12); // mirrored copy starts at (−0, 3)
  const clipped = goalCircle({
    goalCircleRadius: 9,
    lineThickness: 0.25,
    goalCircleFull360: false,
    goalDepth: 4,
    goalDepthToCircle: 1,
    npoints: 10,
  });
  expect(clipped).toHaveLength(2 * 10 + 5);
  expect(clipped[0]).toEqual([5, 0]);
  const a = Math.acos(5 / 9) / Math.PI;
  expect(clipped[1]![0]).toBeCloseTo(9 * Math.cos(a * Math.PI), 10);
});
test("goalArc: undefined thickness reproduces R's NULL recycling (n+5 points, no inner arc); a number gives 2n+5", () => {
  expect(
    goalArc({ goalArcExtension: 1, goalArcRadius: 15, lineThickness: undefined, npoints: 10 }),
  ).toHaveLength(15);
  expect(
    goalArc({ goalArcExtension: 1, goalArcRadius: 15, lineThickness: undefined, npoints: 10 }).slice(-4),
  ).toEqual(
    [
      [1, -15],
      [1, -15],
      [1, 15],
      [1, 15],
    ].map(([x, y]) => [x, y]),
  );
  expect(
    goalArc({ goalArcExtension: 1, goalArcRadius: 15, lineThickness: 0.1111, npoints: 10 }),
  ).toHaveLength(25);
});
test("fieldApron oval is a single point; neutralZone is a zero-width rectangle when nzoneLength = 0 (R quirk preserved)", () => {
  expect(
    fieldApron({ fieldLength: 200, fieldWidth: 85, fieldApronThickness: 5, fieldShape: "oval" }),
  ).toEqual([[0, 0]]);
  expect(
    fieldApron({ fieldLength: 110, fieldWidth: 60, fieldApronThickness: 5, fieldShape: "rectangle" }),
  ).toHaveLength(9);
  expect(neutralZone({ nzoneLength: 0, fieldWidth: 85 })).toEqual([
    [-0, -42.5],
    [0, -42.5],
    [0, 42.5],
    [-0, 42.5],
    [-0, -42.5],
  ]); // x_min = -0/2 = -0 (vitest toEqual tells -0 from 0)
});
test("boards: 4 quarter arcs + 7 seam points; face-off markers O/X/square", () => {
  expect(
    boards({ fieldLength: 200, fieldWidth: 85, cornerRadius: 28, boundaryThickness: 0.25, npoints: 10 }),
  ).toHaveLength(4 * 10 + 7);
  expect(faceOffMarker({ shape: "X", featureThickness: 0.1, sideLength: 1, npoints: 10 })).toHaveLength(14);
  expect(faceOffMarker({ shape: "square", sideLength: 0.1111, npoints: 10 })).toHaveLength(5);
  expect(faceOffMarker({ shape: "o", featureRadius: 0.5, npoints: 10 })).toHaveLength(10);
  expect(faceOffMarker({ shape: "triangle", npoints: 10 })).toEqual([]);
});
