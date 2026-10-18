import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "dataBar: a bar per value, in each team's colour, with its logo",
  tags: ["kind", "dataBar", "data_bars", "reactablefmtr", "nfl"],
} satisfies ExampleMeta;

// reactablefmtr data_bars: the bar's length is wins over the most wins; team + league fill it in the team's colour
// (colorRef would read a colour column instead), and the value sits inside the bar's end in black or white.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.dataBar("wins", {
      label: "Wins",
      team: "team",
      league: "nfl",
      mark: "logo",
      roundEdges: true,
      width: "260px",
    }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
