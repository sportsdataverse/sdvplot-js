import * as Plot from "@observablehq/plot";
import { surface } from "@sportsdataverse/sporty";
import { surfaceMark } from "@sportsdataverse/sporty/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "rotation, xTrans and yTrans move the surface",
  tags: ["plot", "rotation", "xTrans", "yTrans", "tennis", "atp"],
} satisfies ExampleMeta;

// The same court twice: as built (centred on 0, 0), and moved. As in sportyR, xTrans/yTrans shift the court
// first, then `rotation` turns the result about the origin: (80, 10) turned 90 degrees is (-10, 80).
const asBuilt = surface("tennis", "atp");
const moved = surface("tennis", "atp", { rotation: 90, xTrans: 80, yTrans: 10 });

// The axes stay on so the move is visible; both scenes share the plot's feet.
const [ax0, ay0, ax1, ay1] = asBuilt.bbox;
const [bx0, by0, bx1, by1] = moved.bbox;
const centres = [
  [0, 0],
  [-10, 80],
];
export default Plot.plot({
  width: 520,
  aspectRatio: 1,
  x: { domain: [Math.min(ax0, bx0), Math.max(ax1, bx1)], label: "x (ft)" },
  y: { domain: [Math.min(ay0, by0), Math.max(ay1, by1)], label: "y (ft)" },
  marks: [
    ...surfaceMark(asBuilt),
    ...surfaceMark(moved),
    Plot.dot(centres, { r: 4, fill: "currentColor" }),
    Plot.text(centres, { text: ["origin", "(-10, 80)"], dy: -10 }),
  ],
});
