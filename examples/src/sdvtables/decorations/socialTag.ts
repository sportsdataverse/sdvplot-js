import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "socialTag: handles with their icons",
  tags: ["decoration", "socialTag", "gt_social_tag"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.int("losses")])
  .socialTag({ x: "SportsDataverse", gh: "sportsdataverse" }, { caption: "Data: nflverse" })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
