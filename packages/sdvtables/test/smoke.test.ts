import { expect, test } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { VERSION } from "../src/index.js";
test("package imports and VERSION tracks package.json", () => {
  expect(VERSION).toBe(pkg.version);
});
