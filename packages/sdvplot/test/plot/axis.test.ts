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
test("default x axis: image top sits tickSize + tickPadding + 3 below the frame", () => {
  const svg = Plot.plot({ height: 400, marks: [bars(["LV", "LAR"]), axisLogos("x", { league: "nfl" })] });
  const img = svg.querySelector('image[data-sdv-axis="x"]') as Element;
  const t = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(img.parentElement?.getAttribute("transform") ?? "");
  const dy = Number(t?.[2]);
  const frameBottom = 400 - (Math.round(0.1 * 400) + 6 + 8);
  expect(Number(img.getAttribute("y")) + dy).toBeGreaterThan(frameBottom + 6 + 3 + 3 - 1);
  expect(Number(img.getAttribute("y")) + dy).toBeLessThan(frameBottom + 6 + 3 + 3 + 1);
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
  const fx = drawnAxisMarks(svg, "fx");
  expect(fx).toHaveLength(2);
  expect(fx.every((d) => Number.isFinite(d.tick))).toBe(true); // band centres taken from the facet scale
  expect(fx[0]!.tick).toBeLessThan(fx[1]!.tick);
  // fx defaults to anchor "top": logos sit above the frame, in the margin the axis grew
  for (const img of Array.from(svg.querySelectorAll('image[data-sdv-axis="fx"]')))
    expect(Number(img.getAttribute("y")) + Number(img.getAttribute("height"))).toBeLessThanOrEqual(54);
});
test("height out of range throws at construction", () => {
  expect(() => axisLogos("x", { league: "nfl", height: 0 })).toThrow(/height/);
});
test("anchor top on x puts images above the frame and grows marginTop", () => {
  const svg = Plot.plot({
    height: 400,
    marks: [bars(["LV", "LAR"]), axisLogos("x", { league: "nfl", anchor: "top" })],
  });
  const imgs = Array.from(svg.querySelectorAll('image[data-sdv-axis="x"]'));
  expect(imgs).toHaveLength(2);
  // marginTop = round(0.1 * 400) + 6 + 8 = 54; every image ends above it
  for (const img of imgs)
    expect(Number(img.getAttribute("y")) + Number(img.getAttribute("height"))).toBeLessThanOrEqual(54);
  // the frame starts at marginTop: the bars' top-most y cannot be above it
  expect(
    Number(svg.querySelector("g[aria-label='bar'] rect")?.getAttribute("y") ?? 54),
  ).toBeGreaterThanOrEqual(54);
});
test("anchor right on y puts images right of the frame", () => {
  const svg = Plot.plot({
    height: 400,
    width: 640,
    marks: [
      Plot.barX(
        [
          { t: "LV", v: 1 },
          { t: "LAC", v: 2 },
        ],
        { y: "t", x: "v" },
      ),
      axisLogos("y", { league: "nfl", anchor: "right" }),
    ],
  });
  const imgs = Array.from(svg.querySelectorAll('image[data-sdv-axis="y"]'));
  expect(imgs).toHaveLength(2);
  for (const img of imgs) expect(Number(img.getAttribute("x"))).toBeGreaterThanOrEqual(640 - 54);
});
test("an axis with no usable tick position skips the image", () => {
  const svg = Plot.plot({ height: 400, marks: [bars(["LV"]), axisLogos("x", { league: "nfl" })] });
  for (const img of Array.from(svg.querySelectorAll('image[data-sdv-axis="x"]')))
    expect(img.getAttribute("data-sdv-tick")).not.toBe("NaN");
});
