import { expect, test } from "vitest";
import { cornerArc, penaltyBox, pitchApron } from "../../src/soccer/features.js";
test("penaltyBox includes the penalty arc: outer arc from acos-derived start to π, inner arc back", () => {
  const pts = penaltyBox({
    featureRadius: 10,
    featureThickness: 0.139,
    boxLength: 18,
    penaltyMarkDist: 12,
    goalWidth: 8,
    goalPostToBoxEdge: 18,
    npoints: 5,
  });
  expect(pts).toHaveLength(2 + 5 + 5 + 5);
  expect(pts[0]).toEqual([-0.139, 22]);
  expect(pts[1]).toEqual([-18, 22]); // half_box_width = 4 + 18
  const startOuter = 1 - Math.acos((18 - 12) / 10) / Math.PI; // x_out / r
  expect(pts[2]![0]).toBeCloseTo(-12 + 10 * Math.cos(startOuter * Math.PI), 10); // arc centred on the penalty mark
  expect(pts[6]![0]).toBeCloseTo(-12 - 10, 10);
  expect(pts[6]![1]).toBeCloseTo(0, 10); // outer arc ends at angle π
  expect(pts.at(-1)).toEqual([-0.139, 22]);
});
test("penaltyBox degenerate radius falls back to start angle 0.5 (R branch)", () => {
  const pts = penaltyBox({
    featureRadius: 0,
    featureThickness: 0.1,
    boxLength: 18,
    penaltyMarkDist: 12,
    goalWidth: 8,
    goalPostToBoxEdge: 18,
    npoints: 3,
  });
  expect(pts[2]![0]).toBeCloseTo(-12, 12);
  expect(pts[2]![1]).toBeCloseTo(0, 12); // r = 0 → every arc point is the centre
});
test("cornerArc is a quarter ring from π to 1.5π and back", () => {
  const pts = cornerArc({ featureRadius: 1, featureThickness: 0.12, npoints: 3 });
  expect(pts).toHaveLength(6);
  expect(pts[0]![0]).toBeCloseTo(-1, 12);
  expect(pts[2]![1]).toBeCloseTo(-1, 12);
  expect(pts[3]![1]).toBeCloseTo(-(1 - 0.12), 12);
});
test("pitchApron is the 9-point half outline including goal_depth padding", () => {
  expect(
    pitchApron({
      pitchLength: 120,
      pitchWidth: 90,
      pitchApronTouchline: 1,
      pitchApronGoalLine: 1,
      goalDepth: 1.7,
    }),
  ).toEqual([
    [0, 45],
    [60, 45],
    [60, -45],
    [0, -45],
    [0, -47.7],
    [62.7, -47.7],
    [62.7, 47.7],
    [0, 47.7],
    [0, 45],
  ]);
});
