import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "legendDiscrete: a key of named colours",
  tags: ["decoration", "legendDiscrete", "gt_legend_discrete", "gt_centered_legend"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.text("qb"),
    c.colorResults("result_last", { label: "Week 18" }),
  ])
  .legendDiscrete({ Won: "#5DA271", Lost: "#C84630" }, { heading: "Final regular-season game" })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
