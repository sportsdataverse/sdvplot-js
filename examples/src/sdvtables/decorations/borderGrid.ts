import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "borderGrid: vertical rules between columns",
  tags: ["decoration", "borderGrid", "gt_border_grid"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.int("wins"),
    c.int("losses"),
    c.int("pf", { label: "PF" }),
  ])
  .borderGrid({ color: "#C8C8C8", includeLabels: true })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
