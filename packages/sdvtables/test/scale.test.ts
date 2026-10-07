import { expect, test } from "vitest";
import { averageRanks, domainOf, quantile7, ramp, sampleSd } from "../src/scale.js";

test("ramp is piecewise sRGB like great_tables data_color; outside the domain is null", () => {
  const r = ramp(["#000000", "#ffffff"], [0, 10]);
  expect(r(0)).toBe("#000000");
  expect(r(5)).toBe("#808080");
  expect(r(10)).toBe("#ffffff");
  expect(r(11)).toBeNull();
  const r3 = ramp(["#ff0000", "#00ff00", "#0000ff"], [0, 1]);
  expect(r3(0.5)).toBe("#00ff00");
  expect(r3(0.25)).toBe("#808000");
  expect(ramp(["#123456"], [0, 1])(0.3)).toBe("#123456");
});
test("average ranks = Python _ranks: ascending average ranks, desc flips as top − r + 1, nulls stay null", () => {
  expect(averageRanks([10, 20, 20, null, 5], true)).toEqual([2.5, 1, 1, null, 3.5]);
  expect(averageRanks([10, 20, 20, null, 5], false)).toEqual([2, 3.5, 3.5, null, 1]);
  expect(averageRanks([null], true)).toEqual([null]);
});
test("domain over several columns ignores nulls; quantile type 7; sample sd", () => {
  expect(
    domainOf([
      [1, null, 5],
      [-2, 3],
    ]),
  ).toEqual([-2, 5]);
  expect(quantile7([1, 2, 3, 4], 0.25)).toBe(1.75);
  expect(quantile7([1, 2, 3, 4], 0.5)).toBe(2.5);
  expect(sampleSd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
  expect(() => domainOf([[null, null]])).toThrow(/no numeric value/);
});
