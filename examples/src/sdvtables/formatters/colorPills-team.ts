import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "colorPills: a pill in each team's colour",
  tags: ["formatter", "colorPills", "pill_buttons", "reactablefmtr", "nfl"],
} satisfies ExampleMeta;

// reactablefmtr pill_buttons(color_ref): team + league (or colorRef, a colour column) give each row its own pill
// colour; the text turns black or white to stay readable.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.colorPills("wins", { label: "Wins", team: "team", league: "nfl", domain: [0, 17], digits: 0 }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
