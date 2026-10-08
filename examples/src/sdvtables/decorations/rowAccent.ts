import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "rowAccent: an edge colour per row",
  tags: ["decoration", "rowAccent", "gt_row_accent"],
} satisfies ExampleMeta;

// A palette maps each division to a colour; hide (the default) drops the division column itself.
const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.text("division"), c.int("wins"), c.int("losses")])
  .rowAccent("division", { palette: { East: "#00338D", West: "#E31837" }, width: 6 })
  .title("AFC, 2024: East in blue, West in red")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
