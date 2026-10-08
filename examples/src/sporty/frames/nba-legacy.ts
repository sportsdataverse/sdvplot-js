import * as Plot from "@observablehq/plot";
import { surface, toSurfaceFrame } from "@sportsdataverse/sporty";
import { surfaceMark, surfaceScales } from "@sportsdataverse/sporty/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Frame: stats.nba.com legacy shot coordinates",
  tags: ["frames", "toSurfaceFrame", "nba-legacy", "plot", "basketball", "nba"],
} satisfies ExampleMeta;

// stats.nba.com shots: x_legacy/y_legacy (the frame's default columns), tenths of a foot from the hoop,
// x across the court. The frame turns them into court feet; every shot lands on the -x half.
const shots = toSurfaceFrame(
  [
    { x_legacy: 10, y_legacy: 120, made: true },
    { x_legacy: -50, y_legacy: 230, made: false },
  ],
  { from: "nba-legacy" },
);

const court = surface("basketball", "nba", { displayRange: "defense", arcResolution: 48 });
export default Plot.plot({
  ...surfaceScales(court),
  width: 640,
  marks: [
    ...surfaceMark(court),
    Plot.dot(shots, { x: "surface_x", y: "surface_y", r: 6, fill: (d) => (d.made ? "#1b7837" : "#b2182b") }),
  ],
});
