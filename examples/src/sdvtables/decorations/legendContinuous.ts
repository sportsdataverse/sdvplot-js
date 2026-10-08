import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "legendContinuous: a stepped key for a colour scale",
  tags: ["decoration", "legendContinuous", "gt_legend_continuous", "gt_color_legend"],
} satisfies ExampleMeta;

// With no palette or domain of its own, the legend reads the scale the colorPills column recorded.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.colorPills("net_epa", { label: "Net EPA/play", digits: 3, domain: [-0.2, 0.2] }),
  ])
  .legendContinuous({ title: "Net EPA per play", digits: 1 })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
