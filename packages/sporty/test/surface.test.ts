import { expect, test } from "vitest";
import { colorAt } from "../src/surface.js";

test("colorAt recycles like R's data.frame (modulo), not last-colour fallback", () => {
  expect(colorAt(["a", "b"], 2)).toBe("a");
  expect(colorAt("c", 5)).toBe("c");
});
