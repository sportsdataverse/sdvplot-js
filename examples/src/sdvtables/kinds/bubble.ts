import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "bubble: a circle sized and coloured by its value",
  tags: ["kind", "bubble", "bubble_grid", "reactablefmtr"],
} satisfies ExampleMeta;

// reactablefmtr bubble_grid: the circle's width is the value over the column's largest, its colour a ramp over the
// column's range. maxSize shrinks reactablefmtr's 100px to fit a row.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.bubble("pf", { label: "Points for", maxSize: 44 }),
    c.bubble("pa", { label: "Points against", maxSize: 44, colors: ["#FA8C00", "#FFFFFF", "#15607A"] }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
