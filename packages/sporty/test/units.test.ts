import { expect, test } from "vitest";
import { convertUnits } from "../src/units.js";
test("ft↔m↔yd↔mm (R factors)", () => {
  expect(convertUnits(1, "ft", "m")).toBeCloseTo(0.3048, 12);
  expect(convertUnits(1, "yd", "ft")).toBe(3);
  expect(convertUnits(304.8, "mm", "ft")).toBeCloseTo(1, 12);
  expect(convertUnits(94, "ft", "ft")).toBe(94);
});
