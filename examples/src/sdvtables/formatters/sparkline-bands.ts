import { AFC_WEEKS_2024, type AfcWeeks } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "sparkline: an area, the inner-quartile band and the season's first and last values",
  tags: ["formatter", "sparkline", "react_sparkline", "reactablefmtr", "bandline", "statline"],
} satisfies ExampleMeta;

// showArea fills under each unbroken run of weeks (the bye splits it); bandline shades the inner quartiles of the
// team's margins, statline marks the median, and labels prints the first and last weeks beside their points.
const spec = defineTable<AfcWeeks>()
  .columns((c) => [
    c.text("team"),
    c.sparkline("margins", {
      label: "Margin, weeks 1-18",
      lineColor: "#15607A",
      showArea: true,
      bandline: "innerquartiles",
      bandlineColor: "#15607A",
      statline: "median",
      labels: ["first", "last"],
      chartWidth: 220,
    }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, AFC_WEEKS_2024);
