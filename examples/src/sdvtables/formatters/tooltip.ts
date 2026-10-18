import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "tooltip: a cell's value on hover",
  tags: ["formatter", "tooltip", "reactablefmtr"],
} satisfies ExampleMeta;

// tooltip: true on any column writes the cell's value as its title attribute, which the browser shows on hover: here
// the exact net EPA behind each bar. No tooltip library is loaded.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.dataBar("net_epa", {
      label: "Net EPA/play",
      textPosition: "none",
      numberFormat: { digits: 3 },
      tooltip: true,
    }),
  ])
  .title("AFC, 2024: hover a bar")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
