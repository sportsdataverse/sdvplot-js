import { PWHL_GOALS } from "@sportsdataverse/examples/data";
import { FRAMES, toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Frame: the HockeyTech 600x300 canvas",
  tags: ["frames", "toSurfaceFrame", "hockeytech", "hockey"],
} satisfies ExampleMeta;

// HockeyTech leagues report events on a 600 x 300 pixel canvas (top-left origin, y down); the hockeytech frame maps
// it onto a 200 x 85 ft rink with its centre at 0, 0. PWHL game 42's shots span x 31-573 and y 11-292.
const goals = toSurfaceFrame(PWHL_GOALS, { from: "hockeytech" });

export default {
  hockeytech: FRAMES.hockeytech.description,
  "PWHL Boston at Montreal, 2024-03-02 (game 42): goals": goals.map(
    (r) =>
      `${r.team} ${r.scorer}, P${r.period} ${r.time}: (${r.x}, ${r.y}) -> (${r.surface_x?.toFixed(1)}, ${r.surface_y?.toFixed(1)}) ft`,
  ),
};
