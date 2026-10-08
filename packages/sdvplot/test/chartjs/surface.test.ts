// @vitest-environment jsdom
import { Chart, registerables } from "chart.js";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { surface } from "../../src/chartjs-surface.js";
import { InputError, loadLeague, resetWarnings, setWarningHandler } from "../../src/index.js";
import { calls, draw, mockCanvas } from "./harness.js";

Chart.register(...registerables);
const warnings: string[] = [];
beforeAll(async () => {
  await loadLeague("nba");
  mockCanvas();
});
afterEach(() => {
  resetWarnings();
  setWarningHandler(null);
  warnings.length = 0;
});
const collect = () => setWarningHandler((m) => void warnings.push(m));

describe("surface", () => {
  type M = readonly [number, number, number, number, number, number];
  const apply = (m: M, [x, y]: readonly [number, number]): [number, number] => [
    m[0] * x + m[2] * y + m[4],
    m[1] * x + m[3] * y + m[5],
  ];
  const mark = {
    id: "mark",
    beforeDatasetDraw: (c: Chart) => void calls.get(c.canvas)?.push(["dataset", []]),
  };
  test("paints the scene under the datasets, through the chart's own scales (reversed too), clipped to the chart area", () => {
    const s = surface("nba");
    const [x0, y0, x1, y1] = s.scene.bbox;
    expect(s.scales).toEqual({
      x: { type: "linear", min: x0, max: x1 },
      y: { type: "linear", min: y0, max: y1 },
    });
    for (const reverse of [false, true]) {
      const { chart, log } = draw({
        type: "scatter",
        data: { datasets: [{ data: [{ x: 0, y: 0 }] }] },
        options: { scales: { x: { ...s.scales.x, reverse }, y: s.scales.y } },
        plugins: [s.plugin, mark],
      });
      const xs = chart.scales.x!;
      const ys = chart.scales.y!;
      // Chart.js never calls transform(): these are the plugin's, then drawScene's own (which composes with it)
      const ts = log.flatMap(([n], i) => (n === "transform" ? [i] : []));
      expect(ts).toHaveLength(2);
      const [ours, scenes] = ts.map((i) => log[i]![1].slice(0, 6) as unknown as M) as [M, M];
      for (const p of [
        [0, 0],
        [x0, y0],
        [x1, y1],
        [-20, 10],
      ] as const) {
        const [px, py] = apply(ours, apply(scenes, p)); // the chart's own setTransform is the identity at dpr 1
        expect(px).toBeCloseTo(xs.getPixelForValue(p[0]), 6);
        expect(py).toBeCloseTo(ys.getPixelForValue(p[1]), 6);
      }
      const a = chart.chartArea;
      const clip = log
        .slice(0, ts[0])
        .map(([n]) => n)
        .lastIndexOf("clip");
      expect(clip).toBeGreaterThan(0);
      expect(log[clip - 1]![0]).toBe("rect");
      expect(log[clip - 1]![1].slice(0, 4)).toEqual([a.left, a.top, a.right - a.left, a.bottom - a.top]);
      const dataset = log.findIndex(([n]) => n === "dataset");
      expect(dataset).toBeGreaterThan(ts[1]!);
      const court = log.slice(ts[1], dataset).map(([n]) => n);
      expect(court.filter((n) => n === "fill").length).toBeGreaterThan(10);
      expect(court.slice(-2)).toEqual(["restore", "restore"]); // drawScene's, then the clip's: all before the datasets
      // scales but no chartArea (Chart.js itself never gets here: no scales either before its first update): nothing drawn
      const n = log.length;
      const hook = s.plugin.beforeDatasetsDraw as unknown as (c: Chart) => void;
      hook({ ctx: chart.ctx, scales: chart.scales, chartArea: undefined } as unknown as Chart);
      expect(log.length).toBe(n);
      chart.destroy();
    }
  });
  test("an empty bbox throws sdvplot's InputError when the surface is built, not inside a Chart.js draw", () => {
    expect(() => surface("nba", { xlim: [5, 5] })).toThrow(InputError);
    expect(() => surface("nba", { xlim: [5, 5] })).toThrow(/nba.*empty/);
    expect(() => surface("xyz" as "nba")).toThrow(InputError);
  });
  test("a non-linear axis is left unpainted with one warning; a draw before layout and destroy are safe", () => {
    collect();
    const s = surface("nba");
    const { chart, log } = draw({
      type: "scatter",
      data: { datasets: [{ data: [] }] },
      options: { scales: { x: { type: "logarithmic", min: 1, max: 10 }, y: s.scales.y } },
      plugins: [s.plugin],
    });
    chart.update();
    expect(log.some(([n]) => n === "transform")).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(() => chart.destroy()).not.toThrow();
    const canvas = document.createElement("canvas"); // never attached: a responsive chart waits for a layout
    canvas.width = 600;
    canvas.height = 400;
    const early = new Chart(canvas, {
      type: "scatter",
      data: { datasets: [{ data: [] }] },
      options: { animation: false, scales: s.scales },
      plugins: [s.plugin],
    });
    early.resize(600, 400);
    expect(early.chartArea).toBeUndefined();
    expect(() => early.draw()).not.toThrow();
    early.destroy();
  });
});
