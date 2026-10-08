import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "teamColorBar: a bar in the team colour",
  tags: ["kind", "teamColorBar", "reactable_sdv_team_color_bar", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.teamColorBar("team", { league: "nfl", barWidth: 6 }), c.text("qb"), c.int("wins")])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
