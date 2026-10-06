// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { expect, test } from "vitest";
import { InputError } from "../../src/index.js";
import { meanLines, medianLines } from "../../src/plot/index.js";

const rows = [
  { a: 1, b: 10 },
  { a: 2, b: 20 },
  { a: 6, b: 90 },
];
test("meanLines draws a vertical rule at mean(x) and a horizontal rule at mean(y), dashed red", () => {
  const svg = Plot.plot({
    marks: [Plot.dot(rows, { x: "a", y: "b" }), ...meanLines(rows, { x: "a", y: "b" })],
  });
  const x = svg.scale("x")!;
  const y = svg.scale("y")!;
  const rules = Array.from(svg.querySelectorAll("[aria-label^='rule'] line"));
  expect(rules).toHaveLength(2);
  const vertical = rules.find((l) => l.getAttribute("x1") === l.getAttribute("x2"))!;
  expect(Number(vertical.getAttribute("x1"))).toBeCloseTo(x.apply(3), 3);
  const horizontal = rules.find((l) => l.getAttribute("y1") === l.getAttribute("y2"))!;
  expect(Number(horizontal.getAttribute("y1"))).toBeCloseTo(y.apply(40), 3);
  expect(svg.querySelector("[aria-label^='rule']")!.getAttribute("stroke")).toBe("red");
  expect(svg.querySelector("[aria-label^='rule']")!.getAttribute("stroke-dasharray")).toBe("4 4");
});
test("medianLines uses the median and skips a null", () => {
  const svg = Plot.plot({ marks: [...medianLines([...rows, { a: null, b: 30 }], { x: "a" })] });
  expect(Number(svg.querySelector("line")!.getAttribute("x1"))).toBeCloseTo(svg.scale("x")!.apply(2), 3);
});
test("neither x nor y is an InputError", () => {
  expect(() => meanLines(rows, {})).toThrow(InputError);
  expect(() => medianLines(rows, {})).toThrow(InputError);
});
