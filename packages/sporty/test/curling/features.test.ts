import { expect, test } from "vitest";
import { end, hackFoothold, houseRing } from "../../src/curling/features.js";

test("end: downward is y −end_length..0, upward is 0..end_length; end_length = L/2 − tee + hog", () => {
  const o = { sheetLength: 150, sheetWidth: 15.5833, teeLineToCenter: 57, hogLineToTeeLine: 21 };
  expect(end({ ...o, drawnDirection: "downward" })).toEqual([
    [-7.79165, -39],
    [7.79165, -39],
    [7.79165, 0],
    [-7.79165, 0],
    [-7.79165, -39],
  ]);
  expect(end({ ...o, drawnDirection: "upward" })[2]).toEqual([7.79165, 39]);
});

test("houseRing is a full sampled circle; hackFoothold sits right of its anchor and below", () => {
  const r = houseRing({ featureRadius: 6, npoints: 8 });
  expect(r).toHaveLength(8);
  for (const [x, y] of r) expect(Math.hypot(x, y)).toBeCloseTo(6, 12);
  expect(hackFoothold({ footholdDepth: 0.6667, footholdWidth: 0.5 })).toEqual([
    [0, -0.6667],
    [0.5, -0.6667],
    [0.5, 0],
    [0, 0],
    [0, -0.6667],
  ]);
});
