import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "colorPills: values in pills coloured on a scale",
  tags: ["kind", "colorPills", "gt_color_pills"],
} satisfies ExampleMeta;

// A domain fixes the scale so tables can be compared; without one the pills span the observed range and warn.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.colorPills("net_epa", { label: "Net EPA/play", digits: 3, domain: [-0.2, 0.2] }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
