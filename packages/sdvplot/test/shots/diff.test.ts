// @vitest-environment node
import * as Plot from "@observablehq/plot";
import { scaleLinear } from "d3";
import { expect, test } from "vitest";
import ORACLE from "../../../../fixtures/shots/oracle.json" with { type: "json" };
import { diffScale } from "../../src/shots/index.js";

const XS: number[] = ORACLE.main.diff.x;

test("light and dark: the strings blazing-the-nets main's diffColor gives at 61 diffs (theme.ts:47-64)", () => {
  expect(XS.map((d) => diffScale()(d))).toEqual(ORACLE.main.diff.light);
  expect(XS.map((d) => diffScale({ theme: "dark" })(d))).toEqual(ORACLE.main.diff.dark);
  expect(diffScale()(0.15)).toBe("rgb(103, 0, 31)"); // saturates: above league = red
  expect(diffScale()(-1)).toBe("rgb(5, 48, 97)");
});
test("master: master's own expression, d3 scaleLinear over its five stops, unclamped (HexShotchart/index.js:57-64)", () => {
  const colorSet = ["#8d0801", "#bf0603", "#f4d58d", "#708d81", "#195943"];
  const master = scaleLinear<string>().domain([-0.99, -0.15, 0.0, 0.15, 0.99]).range(colorSet);
  const xs = [...XS, -1.2, -0.99, 0.99, 1.2];
  expect(xs.map((d) => diffScale({ palette: "master" })(d))).toEqual(xs.map((d) => master(d)));
});
test("master: an infinite diff takes the end colour (d3 gives rgb(0, 0, 0) and rgb(0, 255, 0)); finite ones extrapolate", () => {
  const s = diffScale({ palette: "master" });
  expect([s(Number.POSITIVE_INFINITY), s(Number.NEGATIVE_INFINITY)]).toEqual([
    "rgb(25, 89, 67)",
    "rgb(141, 8, 1)",
  ]);
  expect([s(0.99), s(-0.99)]).toEqual(["rgb(25, 89, 67)", "rgb(141, 8, 1)"]);
  expect(s(1.2)).not.toBe(s(0.99)); // unclamped past the stops, as d3 scaleLinear
  for (const o of [{}, { theme: "dark" as const }]) {
    const c = diffScale(o);
    expect([c(Number.POSITIVE_INFINITY), c(Number.NEGATIVE_INFINITY)]).toEqual([c(1), c(-1)]); // clamped already
  }
});
test(".plot is the same scale in Observable Plot, so Plot.legend matches (light, dark, master)", () => {
  for (const o of [{}, { theme: "dark" as const }, { palette: "master" as const }]) {
    const s = diffScale(o);
    const p = Plot.scale({ color: s.plot as Plot.ScaleOptions });
    expect(XS.map((d) => p.apply(d))).toEqual(XS.map((d) => s(d)));
  }
});
test("null is nullColor; a non-positive domain throws", () => {
  expect(diffScale()(null)).toBe("var(--sdv-muted, #525252)");
  expect(diffScale({ nullColor: "none" })(null)).toBe("none");
  expect(() => diffScale({ domain: 0 })).toThrow(/domain/);
});
