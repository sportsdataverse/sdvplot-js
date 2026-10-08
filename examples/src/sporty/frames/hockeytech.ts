import { FRAMES, toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Frame: HockeyTech canvases (850x400 and 600x300)",
  tags: ["frames", "toSurfaceFrame", "hockeytech-a", "hockeytech-b", "hockey"],
} satisfies ExampleMeta;

// HockeyTech leagues report events on a pixel canvas (top-left origin, y down). Two canvas sizes exist;
// both frames map onto a 200 x 85 ft rink with its centre at 0, 0. The centre of each canvas lands there.
const a = toSurfaceFrame(
  [
    { x: 640, y: 120 },
    { x: 425, y: 200 },
  ],
  { from: "hockeytech-a" },
);
const b = toSurfaceFrame(
  [
    { x: 300, y: 150 },
    { x: 590, y: 10 },
  ],
  { from: "hockeytech-b" },
);

export default {
  "hockeytech-a": FRAMES["hockeytech-a"].description,
  "850x400 rows": a.map(
    (r) => `(${r.x}, ${r.y}) -> (${r.surface_x?.toFixed(1)}, ${r.surface_y?.toFixed(1)}) ft`,
  ),
  "hockeytech-b": FRAMES["hockeytech-b"].description,
  "600x300 rows": b.map(
    (r) => `(${r.x}, ${r.y}) -> (${r.surface_x?.toFixed(1)}, ${r.surface_y?.toFixed(1)}) ft`,
  ),
};
