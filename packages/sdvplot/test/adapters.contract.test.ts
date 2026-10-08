import { expect, test } from "vitest";
import "./_fixtures.js";
import type {
  AxisOptions,
  DrawnAxisMark,
  DrawnMark,
  HeadshotOptions,
  MarkOptions,
  Row,
} from "../src/_web.js";
import * as echarts from "../src/echarts.js";
import type { Value } from "../src/index.js";
import * as plotly from "../src/plotly.js";
import { type ContractAdapter, checkAdapterContract } from "../src/testing/index.js";
import * as vega from "../src/vega.js";

/** The surface every spec adapter module exports (the contract shim is built from it). */
interface SpecAdapterModule<T> {
  withLogos(t: T, rows: readonly Row[], o: MarkOptions): T;
  withWordmarks(t: T, rows: readonly Row[], o: MarkOptions): T;
  withHeadshots(t: T, rows: readonly Row[], o: HeadshotOptions): T;
  withAxisLogos(t: T, axis: "x" | "y", o: AxisOptions): T;
  drawnMarks(t: T): DrawnMark[];
  drawnAxisMarks(t: T, axis: "x" | "y"): DrawnAxisMark[];
  visibleAxisLabels(t: T, axis: "x" | "y"): string[];
}

// Array.from, not x.map: rule 3 passes Float64Array positions and a typed array's .map coerces objects to NaN.
const rowsOf = (
  x: ArrayLike<Value>,
  y: ArrayLike<Value>,
  who: readonly Value[],
  key: "team" | "player",
): Row[] => Array.from(x, (xi, i) => ({ x: xi, y: y[i], [key]: who[i] }));

function shim<T>(mod: SpecAdapterModule<T>, name: string): ContractAdapter<T> {
  return {
    name,
    addLogos: (t, x, y, teams, o) =>
      mod.withLogos(t, rowsOf(x, y, teams, "team"), { x: "x", y: "y", team: "team", ...o }),
    addWordmarks: (t, x, y, teams, o) =>
      mod.withWordmarks(t, rowsOf(x, y, teams, "team"), { x: "x", y: "y", team: "team", ...o }),
    addHeadshots: (t, x, y, players, o) =>
      mod.withHeadshots(t, rowsOf(x, y, players, "player"), { x: "x", y: "y", player: "player", ...o }),
    axisLogos: (t, axis, o) =>
      mod.withAxisLogos(t, axis, {
        league: o.league,
        ...(o.height !== undefined ? { height: o.height } : {}),
      }),
    supportsAxisLogos: true,
    drawnMarks: (t) =>
      mod.drawnMarks(t).map(([id, x, y, height, url]) => ({
        id,
        x: x as Value,
        y: y as Value,
        height,
        url,
        kind: kindFromName(mod, t, url),
      })),
    drawnAxisMarks: (t, axis) =>
      mod.drawnAxisMarks(t, axis).map(([id, tick, height]) => ({ id, tick, height })),
    visibleAxisLabels: (t, axis) => mod.visibleAxisLabels(t, axis),
  };
}
/** The mark kind is in each adapter's own bookkeeping name ("sdvplot:<kind>:<id>" image name, "sdvplot_<kind>" layer, "sdvplot:<kind>" series). */
function kindFromName<T>(mod: SpecAdapterModule<T>, t: T, url: string): string {
  const json = JSON.stringify(t);
  for (const kind of ["logo", "wordmark", "headshot"])
    if (
      json.includes(`sdvplot:${kind}:`) ||
      json.includes(`"sdvplot_${kind}"`) ||
      json.includes(`"sdvplot:${kind}"`)
    )
      if (json.includes(url)) return kind;
  return "logo";
}

test("sdvplot/plotly passes the adapter contract (rules 0–8)", async () => {
  await expect(
    checkAdapterContract(shim(plotly, "plotly"), {
      makeTarget: () => ({
        data: [{ type: "scatter", x: [0, 30], y: [-10, 0] }],
        layout: { width: 700, height: 450 },
      }),
      makeAxisTarget: (cats) => ({
        data: [{ type: "bar", x: [...cats], y: cats.map((_, i) => i + 1) }],
        layout: {},
      }),
      league: "nfl",
    }),
  ).resolves.toBeUndefined();
});
test("sdvplot/vega passes the adapter contract (rules 0–8)", async () => {
  await expect(
    checkAdapterContract(shim(vega, "vega"), {
      makeTarget: () => ({
        height: 300,
        data: {
          values: [
            { x: 0, y: -10 },
            { x: 30, y: 0 },
          ],
        },
        mark: "point",
        encoding: { x: { field: "x", type: "quantitative" }, y: { field: "y", type: "quantitative" } },
      }),
      makeAxisTarget: (cats) => ({
        height: 300,
        data: { values: cats.map((t, i) => ({ team: t, w: i + 1 })) },
        mark: "bar",
        encoding: {
          x: { field: "team", type: "nominal", sort: null },
          y: { field: "w", type: "quantitative" },
        },
      }),
      league: "nfl",
    }),
  ).resolves.toBeUndefined();
});
test("sdvplot/echarts passes the adapter contract (rules 0–8)", async () => {
  await expect(
    checkAdapterContract(shim(echarts, "echarts"), {
      makeTarget: (): echarts.EChartsOption => ({
        xAxis: { type: "value" },
        yAxis: { type: "value" },
        series: [
          {
            type: "scatter",
            data: [
              [0, -10],
              [30, 0],
            ],
          },
        ],
      }),
      makeAxisTarget: (cats): echarts.EChartsOption => ({
        xAxis: { type: "category", data: [...cats] },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: cats.map((_, i) => i + 1) }],
      }),
      league: "nfl",
    }),
  ).resolves.toBeUndefined();
});
