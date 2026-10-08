import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "mergeStackTeamColor: two lines, the lower in the team colour",
  tags: ["kind", "mergeStackTeamColor", "gt_merge_stack_team_color", "nfl"],
} satisfies ExampleMeta;

// key on top, stack below; team picks the colour (made readable against the table background).
const spec = defineTable<Standing>()
  .columns((c) => [
    c.mergeStackTeamColor("qb", "team", "team", { league: "nfl", label: "Quarterback" }),
    c.int("wins"),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
