import { expect, test } from "vitest";
import { net, courtApron, frontcourtHalf } from "../../src/tennis/features.js";
test("frontcourtHalf is one service box quarter: x 0..serviceline, y ±singles/4", () => {
  expect(frontcourtHalf({ servicelineDistance: 21, singlesWidth: 27 })).toEqual([
    [0, -6.75],
    [21, -6.75],
    [21, 6.75],
    [0, 6.75],
    [0, -6.75],
  ]);
});
test("net is a thin rectangle along y at x = 0 (chair-umpire view)", () => {
  expect(net({ featureThickness: 0.1667, netLength: 42 })).toEqual([
    [-0.08335, -21],
    [0.08335, -21],
    [0.08335, 21],
    [-0.08335, 21],
    [-0.08335, -21],
  ]);
});
test("courtApron is the 9-point half frame with backstop/sidestop padding", () => {
  expect(courtApron({ courtLength: 78, courtWidth: 36, backstopDistance: 21, sidestopDistance: 12 })).toEqual(
    [
      [0, 18],
      [39, 18],
      [39, -18],
      [0, -18],
      [0, -30],
      [60, -30],
      [60, 30],
      [0, 30],
      [0, 18],
    ],
  );
});
