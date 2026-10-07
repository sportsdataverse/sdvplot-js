import { expect, test } from "vitest";
import { InputError, rowsFrom } from "../src/index.js";

test("rowsFrom turns columns into rows", () => {
  expect(rowsFrom({ team: ["KC", "BUF"], n: [1, 2] })).toEqual([
    { team: "KC", n: 1 },
    { team: "BUF", n: 2 },
  ]);
});

test("rowsFrom of an empty object is []", () => {
  expect(rowsFrom({})).toEqual([]);
});

test("rowsFrom throws InputError on unequal column lengths", () => {
  expect(() => rowsFrom({ a: [1, 2], b: [1] })).toThrow(InputError);
});
