import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "boldRows: rows picked by a predicate",
  tags: ["decoration", "boldRows", "gt_bold_rows", "predicate"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.int("losses")])
  .boldRows({ key: "wins", op: ">=", value: 13 }, { highlightColor: "#FFF3B0" })
  .title("AFC, 2024: 13 or more wins")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
