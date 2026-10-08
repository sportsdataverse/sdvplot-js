import * as Plot from "@observablehq/plot";
import { SOCCER_SPECS, frameBottomLeft, surface, toSurfaceFrame } from "@sportsdataverse/sporty";
import { surfaceMark, surfaceScales } from "@sportsdataverse/sporty/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Frame: data with the origin in a corner",
  tags: ["frames", "toSurfaceFrame", "frameBottomLeft", "SOCCER_SPECS", "plot", "soccer", "epl"],
} satisfies ExampleMeta;

// Many feeds put (0, 0) at a corner. frameBottomLeft(length, width) recentres them on the surface.
// sporty's EPL pitch is 120 x 90 m (its spec table), so data in metres from the bottom-left corner flag:
const { pitch_length, pitch_width } = SOCCER_SPECS.epl;
const spots = toSurfaceFrame(
  [
    { x: 0, y: 0, what: "corner flag" },
    { x: pitch_length / 2, y: pitch_width / 2, what: "centre spot" },
    { x: pitch_length - 11, y: pitch_width / 2, what: "penalty mark" },
  ],
  { from: frameBottomLeft(pitch_length, pitch_width) },
);

const pitch = surface("soccer", "epl", { arcResolution: 48 }); // 48 points per arc: plenty at 640 px
export default Plot.plot({
  ...surfaceScales(pitch),
  width: 640,
  marks: [
    ...surfaceMark(pitch),
    Plot.dot(spots, { x: "surface_x", y: "surface_y", r: 5, fill: "#b2182b" }),
    Plot.text(spots, { x: "surface_x", y: "surface_y", text: "what", dy: -12 }),
  ],
});
