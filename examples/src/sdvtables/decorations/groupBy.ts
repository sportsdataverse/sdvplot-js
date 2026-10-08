import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "groupBy: a heading row per group",
  tags: ["decoration", "groupBy"],
} satisfies ExampleMeta;

// Rows are grouped in the order they arrive: sort them first if the groups are interleaved.
const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.text("qb"), c.int("wins"), c.int("losses")])
  .groupBy("division")
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
