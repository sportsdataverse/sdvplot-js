// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { beforeAll, expect, test } from "vitest";
import { loadLeague, resetWarnings, setWarningHandler } from "../../src/index.js";
import { axisLogos } from "../../src/plot/index.js";
import { drawnAxisMarks, visibleAxisLabels } from "../../src/testing/index.js";

const bars = (c: string[]) =>
  Plot.barY(
    c.map((t, i) => ({ t, v: i + 1 })),
    { x: "t", y: "v" },
  );
beforeAll(() => loadLeague("nfl"));

test("known categories become images in tick order; the unknown one stays text; one warning", () => {
  const warned: string[] = [];
  resetWarnings();
  setWarningHandler((m) => warned.push(m));
  const svg = Plot.plot({
    height: 400,
    marks: [bars(["LV", "XXX", "LAR"]), axisLogos("x", { league: "nfl", height: 0.1 })],
  });
  setWarningHandler(null);
  const m = drawnAxisMarks(svg, "x");
  expect(m).toHaveLength(2);
  expect(m[0]!.tick).toBeLessThan(m[1]!.tick);
  expect(m.every((d) => Math.abs(d.height - 0.1) < 0.001)).toBe(true);
  expect(visibleAxisLabels(svg, "x")).toEqual(["XXX"]);
  expect(warned).toHaveLength(1);
});
test("y axis and wordmarks", () => {
  const svg = Plot.plot({
    height: 400,
    marks: [
      Plot.barX(
        [
          { t: "LV", v: 1 },
          { t: "LAC", v: 2 },
        ],
        { y: "t", x: "v" },
      ),
      axisLogos("y", { league: "nfl", markType: "wordmark", height: 0.2 }),
    ],
  });
  expect(drawnAxisMarks(svg, "y").map((d) => d.height)).toEqual([
    expect.closeTo(0.2, 3),
    expect.closeTo(0.2, 3),
  ]);
});
test("fx facet axis shows a logo per facet", () => {
  const data = [
    { t: "LV", x: 1, y: 1 },
    { t: "LAR", x: 2, y: 2 },
  ];
  const svg = Plot.plot({
    facet: { data, x: "t" },
    marks: [Plot.dot(data, { x: "x", y: "y" }), axisLogos("fx", { league: "nfl" })],
  });
  expect(drawnAxisMarks(svg, "fx")).toHaveLength(2);
});
test("height out of range throws at construction", () => {
  expect(() => axisLogos("x", { league: "nfl", height: 0 })).toThrow(/height/);
});
