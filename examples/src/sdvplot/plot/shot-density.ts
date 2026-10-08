import * as Plot from "@observablehq/plot";
import { BKN_SHOTS_2026 } from "@sportsdataverse/examples/data";
import { surface } from "@sportsdataverse/sdvplot/plot";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Where the 2025-26 Nets shoot from: density contours of 2,000 shots on the court (Plot.density)",
  tags: ["plot", "density", "surface", "toSurfaceFrame", "nba"],
} satisfies ExampleMeta;

// stats.nba.com rows (x_legacy / y_legacy, tenths of a foot from the hoop) into the court's feet. The court's
// aspectRatio 1 keeps a pixel the same distance both ways, so the kernel is round on the floor.
// (ShotRow is an interface, so spread each row into a plain object: toSurfaceFrame takes indexable rows)
const shots = toSurfaceFrame(
  BKN_SHOTS_2026.map((s) => ({ ...s })),
  { from: "nba-legacy" },
);
const court = surface("nba", { displayRange: "defense", arcResolution: 48 });
export default Plot.plot({
  ...court.scales,
  width: 640,
  color: { scheme: "YlOrRd", type: "sqrt" },
  marks: [
    ...court.marks,
    Plot.density(shots, {
      x: "surface_x",
      y: "surface_y",
      bandwidth: 10,
      fill: "density",
      fillOpacity: 0.45,
    }),
    Plot.density(shots, {
      x: "surface_x",
      y: "surface_y",
      bandwidth: 10,
      thresholds: 12,
      stroke: "currentColor",
      strokeOpacity: 0.5,
    }),
  ],
});
