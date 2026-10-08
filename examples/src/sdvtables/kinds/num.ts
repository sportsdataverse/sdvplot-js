import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "num: digits, a forced sign, a prefix or suffix",
  tags: ["kind", "num"],
} satisfies ExampleMeta;

// New England has no net EPA on file (null): the cell stays blank.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.num("net_epa", { label: "Net EPA/play", digits: 3, forceSign: true }),
    c.num("pf", { label: "Points for", digits: 0, suffix: " pts" }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
