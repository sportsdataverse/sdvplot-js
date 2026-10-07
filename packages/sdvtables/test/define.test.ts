// test/define.test.ts — predicates
import { expect, test } from "vitest";
import { matches, selectRows } from "../src/predicate.js";
import { STANDINGS } from "./fixtures/standings.js";
test("data predicates", () => {
  expect(matches({ key: "wins", op: ">=", value: 10 }, STANDINGS[0]!)).toBe(true);
  expect(matches({ key: "team", op: "in", value: ["KC", "BUF"] }, STANDINGS[5]!)).toBe(false);
  expect(matches({ key: "net_epa", op: "isNull" }, STANDINGS[7]!)).toBe(true);
  expect(selectRows([0, 2], STANDINGS)).toEqual([0, 2]);
  expect(selectRows({ key: "division", op: "==", value: "East" }, STANDINGS)).toEqual([4, 5, 6, 7]);
  expect(() => selectRows([99], STANDINGS)).toThrow(/row 99/);
});
