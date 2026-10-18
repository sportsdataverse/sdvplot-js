import { AFC_WEEKS_2024, type AfcWeeks } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "sparkbar: points scored each week, the best week labelled",
  tags: ["kind", "sparkbar", "react_sparkbar", "reactablefmtr", "nfl"],
} satisfies ExampleMeta;

// reactablefmtr react_sparkbar: a bar per week standing on zero; the bye leaves an empty slot. highlightBars recolours
// the best week, labels prints its value above the bar, and the table's text colour draws the label.
const spec = defineTable<AfcWeeks>()
  .columns((c) => [
    c.text("team"),
    c.sparkbar("points", {
      label: "Points, weeks 1-18",
      highlightBars: { max: "#FA8C00" },
      labels: ["max"],
      chartWidth: 180,
    }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, AFC_WEEKS_2024);
