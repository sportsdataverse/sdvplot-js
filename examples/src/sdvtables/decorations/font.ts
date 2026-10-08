import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "font: one Google font for the whole table",
  tags: ["decoration", "font", "gt_set_font"],
} satisfies ExampleMeta;

// google: true (the default) adds the Google Fonts <link>; set it false for a font the page already loads.
const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.text("qb"), c.int("wins"), c.int("losses")])
  .font("Roboto Slab", { weight: 500 })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
