import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "dataBar: diverging bars for a column with negatives",
  tags: ["formatter", "dataBar", "data_bars", "reactablefmtr", "posNeg"],
} satisfies ExampleMeta;

// A column with a negative value draws its bars either side of a centre line; with two fill colours the first paints
// the negatives. New England's missing net EPA stays blank.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.dataBar("net_epa", {
      label: "Net EPA/play",
      fill: ["#C84630", "#5DA271"],
      textPosition: "outside-end",
      numberFormat: { digits: 3 },
      width: "260px",
    }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
