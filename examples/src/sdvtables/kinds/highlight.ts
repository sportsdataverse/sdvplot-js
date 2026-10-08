import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "highlight: cells that match a predicate",
  tags: ["kind", "highlight", "gt_highlight_cells", "predicate"],
} satisfies ExampleMeta;

// The rule is data (a predicate), not a function, so the spec stays serializable.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.highlight("wins", { key: "wins", op: ">=", value: 11 }, { label: "Wins", bold: true }),
    c.int("losses"),
  ])
  .title("AFC, 2024: 11 or more wins")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
