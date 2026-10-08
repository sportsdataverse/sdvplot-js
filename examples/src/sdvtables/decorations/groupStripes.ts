import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "groupStripes: every other group shaded",
  tags: ["decoration", "groupStripes", "gt_group_stripes"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.text("qb"), c.int("wins"), c.int("losses")])
  .groupBy("division")
  .groupStripes({ color: "#EEF3FA", start: 1 })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
