import { SUPER_BOWL_LIX_TDS } from "@sportsdataverse/examples/data";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Frame: ESPN football yardlines",
  tags: ["frames", "toSurfaceFrame", "espn-football-0-100", "football"],
} satisfies ExampleMeta;

// ESPN plays: a 0-100 yardline from the home team's goal line (Super Bowl LIX's touchdowns, Philadelphia at home).
// The frame centres the field: midfield is x = 0. `x`/`y` pick the input columns and `out` names the outputs, so the
// frame fits any table. ESPN reports no lateral position, so these rows have no `y` and field_y is null, never NaN.
export default toSurfaceFrame(
  SUPER_BOWL_LIX_TDS.map(({ team, clock, period, yardline }) => ({ team, period, clock, yardline })),
  { from: "espn-football-0-100", x: "yardline", out: { x: "field_x", y: "field_y" } },
);
