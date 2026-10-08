import * as Plot from "@observablehq/plot";
import { WC2018_FINAL_FRANCE_PASSES } from "@sportsdataverse/examples/data";
import { frameBottomLeft, surface, toSurfaceFrame } from "@sportsdataverse/sporty";
import { surfaceMark, surfaceScales } from "@sportsdataverse/sporty/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Pass map: France's completed first-half passes, 2018 World Cup final (Plot.arrow on a pitch)",
  tags: ["plot", "arrow", "surface", "toSurfaceFrame", "frameBottomLeft", "soccer", "fifa", "statsbomb"],
} satisfies ExampleMeta;

// StatsBomb open data as SPADL: metres from the bottom-left corner of a 105 x 68 pitch, France attacking left to
// right. The pitch is sporty's FIFA pitch at those dimensions, so the data and the lines share one frame.
const frame = frameBottomLeft(105, 68);
const starts = toSurfaceFrame(WC2018_FINAL_FRANCE_PASSES, {
  from: frame,
  x: "start_x",
  y: "start_y",
  out: { x: "x1", y: "y1" },
});
const passes = toSurfaceFrame(starts, { from: frame, x: "end_x", y: "end_y", out: { x: "x2", y: "y2" } });
const pitch = surface("soccer", "fifa", {
  updates: { pitch_length: 105, pitch_width: 68 },
  arcResolution: 48,
});
export default Plot.plot({
  ...surfaceScales(pitch),
  width: 760,
  caption: "Data: StatsBomb open data (match 8658), as socceraction SPADL.",
  marks: [
    ...surfaceMark(pitch),
    Plot.arrow(passes, {
      x1: "x1",
      y1: "y1",
      x2: "x2",
      y2: "y2",
      stroke: "#002395",
      strokeWidth: 1.25,
      headLength: 6,
    }),
  ],
});
