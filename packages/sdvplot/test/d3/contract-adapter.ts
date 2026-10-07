import { type ScaleLinear, type Selection, scaleLinear, select } from "d3";
import { appendHeadshots, appendLogos, appendWordmarks } from "../../src/d3/index.js";
import { UnsupportedTargetError } from "../../src/index.js";
import type { Value } from "../../src/resolve.js";
import { type ContractAdapter, drawnMarks } from "../../src/testing/index.js";

export type Target = Selection<SVGSVGElement, unknown, null, undefined>;
const x: ScaleLinear<number, number> = scaleLinear().domain([0, 30]).range([0, 600]);
const [top, bottom] = [0, 350] as const;
const y: ScaleLinear<number, number> = scaleLinear().domain([-10, 0]).range([bottom, top]);
const common = {
  x: (v: Value) => x(Number(v)),
  y: (v: Value) => y(Number(v)),
  frameHeight: Math.abs(bottom - top),
};
/** Drops undefined keys (exactOptionalPropertyTypes). */
const defined = <O extends object>(o: O): O =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as O;

export const makeTarget = (): Target => select(document.body).append("svg");
export const d3Adapter: ContractAdapter<Target> = {
  name: "d3",
  addLogos: (t, xs, ys, teams, o) => {
    appendLogos(t, xs, ys, teams, { ...common, ...defined(o) });
    return t;
  },
  addWordmarks: (t, xs, ys, teams, o) => {
    appendWordmarks(t, xs, ys, teams, { ...common, ...defined(o) });
    return t;
  },
  addHeadshots: (t, xs, ys, ids, o) => {
    appendHeadshots(t, xs, ys, ids, { ...common, ...defined(o) });
    return t;
  },
  axisLogos: () => {
    throw new UnsupportedTargetError(
      "d3 has no axis to swap labels on; draw with appendLogos at the tick positions",
    );
  },
  supportsAxisLogos: false,
  drawnMarks: (t) => {
    const node = t.node();
    return node === null ? [] : drawnMarks(node);
  },
  drawnAxisMarks: () => [],
  visibleAxisLabels: () => [],
};
