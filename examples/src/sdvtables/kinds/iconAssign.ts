import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "iconAssign: a value as a row of icons",
  tags: ["kind", "iconAssign", "icon_assign", "reactablefmtr"],
} satisfies ExampleMeta;

// reactablefmtr icon_assign with buckets: each team's wins as its fifth of the column, out of five stars.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.iconAssign("wins", { label: "Wins", buckets: 5, icon: "star", fill: "#D6AF36", showValues: "right" }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
