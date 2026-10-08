import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "highlightNa: missing values marked",
  tags: ["kind", "highlightNa", "gt_highlight_na"],
} satisfies ExampleMeta;

// New England's net EPA is null in the sample data.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.highlightNa("net_epa", { label: "Net EPA/play", missingText: "n/a", italic: true }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
