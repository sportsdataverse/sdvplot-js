import * as Plot from "@observablehq/plot";
import { surface } from "@sportsdataverse/sporty";
import { surfaceMark, surfaceScales } from "@sportsdataverse/sporty/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Observable Plot: surfaceMark and surfaceScales",
  tags: ["plot", "surfaceMark", "surfaceScales", "baseball", "mlb"],
} satisfies ExampleMeta;

// surfaceScales fixes x/y to the scene's bbox (feet, no axes, aspect 1); surfaceMark draws the scene through
// those scales, so data in feet lands where it belongs. Baseball's origin is home plate; these are the rule book's
// landmarks (60.5 ft to the rubber, 90 ft base paths), not observations.
const field = surface("baseball", "mlb");
const spots = [
  { x: 0, y: 60.5, what: "pitcher's rubber" },
  { x: 63.6, y: 63.6, what: "first base" },
  { x: 0, y: 127.3, what: "second base" },
];

export default Plot.plot({
  ...surfaceScales(field),
  width: 560,
  marks: [
    ...surfaceMark(field),
    Plot.dot(spots, { x: "x", y: "y", r: 5, fill: "white", stroke: "black" }),
    Plot.text(spots, { x: "x", y: "y", text: "what", dy: -12, fill: "white" }),
  ],
});
