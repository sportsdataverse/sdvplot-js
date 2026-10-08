import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "colorResults: a row filled by its result",
  tags: ["kind", "colorResults", "gt_color_results"],
} satisfies ExampleMeta;

// The cell holds W or L; the whole row takes the win or loss fill.
const spec = defineTable<Standing>()
  .columns((c) => [c.text("team"), c.text("qb"), c.colorResults("result_last", { label: "Last game" })])
  .title("AFC, 2024: final regular-season game")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
