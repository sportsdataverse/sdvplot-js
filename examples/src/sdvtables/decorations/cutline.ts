import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "cutline: a dashed line after the nth row",
  tags: ["decoration", "cutline", "gt_cutline"],
} satisfies ExampleMeta;

// Sorted by wins, the four playoff teams among these eight sit above the line.
const rows = [...STANDINGS].sort((a, b) => b.wins - a.wins);
const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.int("losses")])
  .cutline(4, { label: ["Playoff line"] })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, rows);
