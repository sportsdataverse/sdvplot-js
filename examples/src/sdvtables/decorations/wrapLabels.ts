import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "wrapLabels: long column labels on several lines",
  tags: ["decoration", "wrapLabels", "gt_wrap_labels"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.int("pf", { label: "Points scored, regular season" }),
    c.int("pa", { label: "Points allowed, regular season" }),
  ])
  .wrapLabels({ width: 10 })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
