import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "iconSet: an icon beside each value, by its third of the column",
  tags: ["kind", "iconSet", "icon_sets", "reactablefmtr"],
} satisfies ExampleMeta;

// reactablefmtr icon_sets: icons and colours are each dealt out in equal-count buckets (dplyr::ntile), so the bottom
// third of points scored gets the first icon and colour. The icons are inline SVG, not an icon font.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.iconSet("pf", {
      label: "Points for",
      icons: ["arrow-down", "minus", "arrow-up"],
      colors: ["#C84630", "#9A9A9A", "#5DA271"],
    }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
