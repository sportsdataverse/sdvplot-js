import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "borderBars: colour bars above and below",
  tags: ["decoration", "borderBars", "gt_border_bars_top", "gt_border_bars_bottom"],
} satisfies ExampleMeta;

// Bars only: one bar per colour. With text (or an image): one bar in the first colour holding it.
const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.int("losses")])
  .borderBars("top", ["#0B1A33", "#7FE6DC"], { barHeight: 6 })
  .borderBars("bottom", ["#0B1A33"], { barHeight: 28, text: "SportsDataverse", textSize: 13 })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
