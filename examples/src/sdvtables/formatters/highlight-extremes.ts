import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "highlight: a column's minimum and maximum",
  tags: ["formatter", "highlight", "highlight_min", "highlight_max", "highlight_min_max", "reactablefmtr"],
} satisfies ExampleMeta;

// "both" marks the lowest value in red and the highest in green, bold, every tie included; "min" or "max" marks one.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.highlight("wins", "both", { label: "Wins" }),
    c.highlight("pf", "max", { label: "Points for", fill: "#FFF3B0", textColor: "#000000" }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
