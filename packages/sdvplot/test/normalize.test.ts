import { expect, test } from "vitest";
import { InputError } from "../src/errors.js";
import { normSeason, normValue } from "../src/normalize.js";

test.each([
  [14, "14"],
  ["14", "14"],
  [14.0, "14"],
  ["14.0", "14"],
  [" 14 ", "14"],
  ["-13.00", "-13"],
  ["San José State", "san jose state"],
  ["O’Brien", "o'brien"],
  ["Texas A&M", "texas a&m"],
  ["", null],
  [null, null],
  [undefined, null],
  [Number.NaN, null],
  [true, "true"],
  [12.5, "12.5"],
])("normValue(%j) = %j", (v, want) => expect(normValue(v)).toBe(want));

test("normSeason accepts 2020, 2020.0, '2020'; rejects split seasons with a hint", () => {
  expect(normSeason(2020)).toBe(2020);
  expect(normSeason("2020")).toBe(2020);
  expect(normSeason(null)).toBeNull();
  expect(() => normSeason("2020-21")).toThrowError(/ending year \(2021/);
  expect(() => normSeason("x")).toThrow(InputError);
});
