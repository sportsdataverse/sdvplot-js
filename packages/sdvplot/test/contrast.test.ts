import { expect, test } from "vitest";
import { contrast, hex6, luminance, mix, onColor, solid } from "../src/contrast.js";
test("hex6 forms", () => {
  expect(hex6("#FFF")).toBe("#ffffff");
  expect(hex6("e31837")).toBe("#e31837");
  expect(hex6("#e31837ff")).toBe("#e31837");
  expect(() => hex6("#e3183780")).toThrow(/transparency/);
  expect(hex6("#e3183780", { dropAlpha: true })).toBe("#e31837");
  expect(() => hex6("red")).toThrow(/not a hex/);
});
test("luminance/contrast/onColor", () => {
  expect(luminance("#ffffff")).toBeCloseTo(1, 6);
  expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 6);
  expect(onColor("#e31837")).toBe("#ffffff");
  expect(onColor("#ffb612")).toBe("#000000");
});
test("mix and solid", () => {
  expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  expect(solid("#00000080")).toBe("#7f7f7f");
  expect(() => mix("#000", "#fff", 1.5)).toThrow();
});
