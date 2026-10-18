import * as Plot from "@observablehq/plot";
import { surface } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Lacrosse shot map on an NCAA men's field, offensive half (illustrative shot locations)",
  tags: ["plot", "surface", "displayRange", "lacrosse", "ncaa_mlacrosse"],
} satisfies ExampleMeta;

// ILLUSTRATIVE shots, not real data: SDV has no lacrosse shot locations. NCAA men's fields are in yards, centred on
// midfield; this goal line sits 15 yd in from the end line, at x = 110 / 2 - 15 = 40.
const SHOTS = [
  { x: 28, y: 6, outcome: "goal" },
  { x: 31, y: -4, outcome: "saved" },
  { x: 25, y: 12, outcome: "wide" },
  { x: 34, y: 2, outcome: "goal" },
  { x: 22, y: -9, outcome: "saved" },
  { x: 36, y: -6, outcome: "goal" },
  { x: 30, y: 15, outcome: "wide" },
  { x: 33, y: 9, outcome: "saved" },
  { x: 27, y: -1, outcome: "goal" },
  { x: 38, y: 4, outcome: "saved" },
];

// A surface key with no team identities draws the plain field (passing a team would throw InputError).
const field = surface("ncaa_mlacrosse", { displayRange: "offense" });
export default Plot.plot({
  ...field.scales,
  width: 640,
  color: {
    domain: ["goal", "saved", "wide"],
    range: ["#ffcb05", "#ffffff", "#8a8a8a"],
    legend: true,
  },
  marks: [
    ...field.marks,
    Plot.link(SHOTS, { x1: "x", y1: "y", x2: 40, y2: 0, stroke: "outcome", strokeOpacity: 0.5 }),
    Plot.dot(SHOTS, { x: "x", y: "y", r: 7, fill: "outcome", stroke: "#195f0c", strokeWidth: 1.5 }),
  ],
});
