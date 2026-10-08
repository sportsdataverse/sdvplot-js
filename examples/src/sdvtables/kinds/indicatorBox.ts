import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "indicatorBox: a filled box for a yes",
  tags: ["kind", "indicatorBox", "gt_indicator_boxes"],
} satisfies ExampleMeta;

// truthy lists the values that fill the box; everything else gets the neutral box.
const spec = defineTable<Standing>()
  .columns((c) => [c.text("team"), c.indicatorBox("result_last", { label: "Won week 18", truthy: ["W"] })])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
