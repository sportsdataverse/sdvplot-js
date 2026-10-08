import { PWHL_GOALS } from "@sportsdataverse/examples/data";
import { FRAMES, toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Frame: HockeyTech canvases (850x400 and 600x300)",
  tags: ["frames", "toSurfaceFrame", "hockeytech-a", "hockeytech-b", "hockey"],
} satisfies ExampleMeta;

// HockeyTech leagues report events on a pixel canvas (top-left origin, y down). sporty has a frame for each of two
// canvas sizes; both map onto a 200 x 85 ft rink with its centre at 0, 0. PWHL game 42's shots span x 31-573 and
// y 11-292, the 600 x 300 canvas, so its goals go through hockeytech-b. No capture yet is on 850 x 400.
const goals = toSurfaceFrame(PWHL_GOALS, { from: "hockeytech-b" });

export default {
  "hockeytech-b": FRAMES["hockeytech-b"].description,
  "PWHL Boston at Montreal, 2024-03-02 (game 42): goals": goals.map(
    (r) =>
      `${r.team} ${r.scorer}, P${r.period} ${r.time}: (${r.x}, ${r.y}) -> (${r.surface_x?.toFixed(1)}, ${r.surface_y?.toFixed(1)}) ft`,
  ),
  "hockeytech-a": FRAMES["hockeytech-a"].description,
};
