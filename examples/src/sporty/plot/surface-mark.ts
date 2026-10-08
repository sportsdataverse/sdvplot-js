import * as Plot from "@observablehq/plot";
import { surface } from "@sportsdataverse/sporty";
import { surfaceMark, surfaceScales } from "@sportsdataverse/sporty/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Observable Plot: surfaceMark and surfaceScales",
  tags: ["plot", "surfaceMark", "surfaceScales", "baseball", "mlb"],
} satisfies ExampleMeta;

// surfaceScales fixes x/y to the scene's bbox (feet, no axes, aspect 1); surfaceMark draws the scene through
// those scales, so data in feet lands where it belongs. Baseball's origin is home plate.
const field = surface("baseball", "mlb");
const hits = [
  { x: 0, y: 60.5, what: "pitcher's rubber" },
  { x: 63.6, y: 63.6, what: "first base" },
  { x: -230, y: 300, what: "a deep fly to left" },
];

export default Plot.plot({
  ...surfaceScales(field),
  width: 560,
  marks: [
    ...surfaceMark(field),
    Plot.dot(hits, { x: "x", y: "y", r: 5, fill: "white", stroke: "black" }),
    Plot.text(hits, { x: "x", y: "y", text: "what", dy: -12, fill: "white" }),
  ],
});
