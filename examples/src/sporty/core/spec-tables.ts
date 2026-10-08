import { BASKETBALL_SPECS } from "@sportsdataverse/sporty";
import * as specs from "@sportsdataverse/sporty/specs";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The dimension tables behind every league",
  tags: ["specs", "BASKETBALL_SPECS", "basketball", "nba"],
} satisfies ExampleMeta;

// Every league is a row of numbers (sportyR's surface dimensions, in the league's own units).
const nba = BASKETBALL_SPECS.nba;

// @sportsdataverse/sporty/specs exports one *_SPECS table per sport.
const tables = Object.entries(specs).filter(([name]) => name.endsWith("_SPECS"));

export default {
  "BASKETBALL_SPECS.nba lane": {
    court_units: nba.court_units,
    lane_width: nba.lane_width.join(", "),
    lane_length: nba.lane_length.join(", "),
    free_throw_line_to_backboard: nba.free_throw_line_to_backboard,
    basket_center_to_three_point_arc: nba.basket_center_to_three_point_arc.join(", "),
  },
  "@sportsdataverse/sporty/specs": Object.fromEntries(
    tables.map(([name, table]) => [
      name,
      `${Object.keys(table).length} leagues: ${Object.keys(table).join(", ")}`,
    ]),
  ),
};
