import { AFC_WEEKS_2024, type AfcWeeks } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "sparkline: each team's weekly margin as a line in its colour",
  tags: ["kind", "sparkline", "react_sparkline", "reactablefmtr", "nfl"],
} satisfies ExampleMeta;

// reactablefmtr react_sparkline: one line per row from an array column. team + league colour each line (checked for
// contrast on the table's background); the bye week is a gap, the worst and best weeks are marked, and the dashed
// statline sits at the team's mean margin. Hover a chart for its summary.
const spec = defineTable<AfcWeeks>()
  .columns((c) => [
    c.text("team"),
    c.sparkline("margins", {
      label: "Margin, weeks 1-18",
      team: "team",
      league: "nfl",
      highlightPoints: { min: "#C84630", max: "#3D8B6E" },
      pointSize: 2,
      statline: "mean",
      chartWidth: 180,
    }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, AFC_WEEKS_2024);
