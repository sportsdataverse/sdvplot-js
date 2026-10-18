import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "gauge: wins out of 17 as a half circle in each team's colour",
  tags: ["kind", "gauge", "gauge_chart", "reactablefmtr", "nfl"],
} satisfies ExampleMeta;

// reactablefmtr gauge_chart: the arc fills |value| of the way from minValue (0) to maxValue (here a 17-game season;
// by default the column's largest value). team + league colour each gauge; showMinMax prints the scale's ends.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.gauge("wins", {
      label: "Wins",
      team: "team",
      league: "nfl",
      maxValue: 17,
      showMinMax: true,
      boldText: true,
    }),
    c.gauge("pf", { label: "Points for", fill: ["#C84630", "#EDE0CC", "#3D8B6E"], minValue: 250 }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
