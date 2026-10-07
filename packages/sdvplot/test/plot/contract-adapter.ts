import * as Plot from "@observablehq/plot";
import { axisLogos, headshots, logos, wordmarks } from "../../src/plot/index.js";
import type { Value } from "../../src/resolve.js";
import {
  type ContractAdapter,
  drawnAxisMarks,
  drawnMarks,
  visibleAxisLabels,
} from "../../src/testing/index.js";

export type Target = Plot.PlotOptions & { marks: Plot.Markish[] };
export const makeTarget = (): Target => ({
  height: 400,
  marginTop: 20,
  marginBottom: 30,
  x: { domain: [0, 30] },
  y: { domain: [-10, 0] },
  marks: [],
});
export const makeAxisTarget = (categories: readonly string[]): Target => ({
  height: 400,
  x: { domain: [...categories] },
  marks: [
    Plot.barY(
      categories.map((c, i) => ({ c, v: i + 1 })),
      { x: "c", y: "v" },
    ),
  ],
});
const rows = (x: ArrayLike<Value>, y: ArrayLike<Value>, t: readonly Value[]) =>
  Array.from(t, (ti, i) => ({ x: x[i], y: y[i], t: ti }));
/** Drops undefined keys (exactOptionalPropertyTypes). */
const defined = <O extends object>(o: O): O =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as O;

export const plotAdapter: ContractAdapter<Target> = {
  name: "plot",
  addLogos: (tg, x, y, teams, o) => ({
    ...tg,
    marks: [...tg.marks, logos(rows(x, y, teams), { x: "x", y: "y", team: "t", ...defined(o) })],
  }),
  addWordmarks: (tg, x, y, teams, o) => ({
    ...tg,
    marks: [...tg.marks, wordmarks(rows(x, y, teams), { x: "x", y: "y", team: "t", ...defined(o) })],
  }),
  addHeadshots: (tg, x, y, ids, o) => ({
    ...tg,
    marks: [...tg.marks, headshots(rows(x, y, ids), { x: "x", y: "y", player: "t", ...defined(o) })],
  }),
  axisLogos: (tg, axis, o) => ({ ...tg, marks: [...tg.marks, axisLogos(axis, o)] }),
  supportsAxisLogos: true,
  drawnMarks: (tg) => drawnMarks(Plot.plot(tg)),
  drawnAxisMarks: (tg, ax) => drawnAxisMarks(Plot.plot(tg), ax),
  visibleAxisLabels: (tg, ax) => visibleAxisLabels(Plot.plot(tg), ax),
};
