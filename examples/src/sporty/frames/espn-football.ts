import { toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Frame: ESPN football yardlines",
  tags: ["frames", "toSurfaceFrame", "espn-football-0-100", "football"],
} satisfies ExampleMeta;

// ESPN plays: x a 0-100 yardline, y in yards from the middle. The frame centres the field: midfield is x = 0.
// `x`/`y` pick the input columns and `out` names the outputs, so the frame fits any table.
export default toSurfaceFrame(
  [
    { yardline: 75, lateral: 5, team: "KC" },
    { yardline: 30, lateral: -10, team: "BUF" },
    { yardline: null, lateral: 0, team: "KC" }, // a missing coordinate gives null, never NaN
  ],
  { from: "espn-football-0-100", x: "yardline", y: "lateral", out: { x: "field_x", y: "field_y" } },
);
