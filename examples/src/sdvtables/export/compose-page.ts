import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { composePage } from "@sportsdataverse/sdvtables/export";
import { renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "composePage: the title and notes frame around any HTML",
  tags: ["node", "table", "export", "composePage", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.int("pf", { label: "Points for" }),
    c.int("pa", { label: "Points against" }),
  ])
  .theme("swiss")
  .build();
// the frame gridTables and stackTables put around their tables, here around one table of your own
export default composePage(renderHTML(spec, STANDINGS), {
  title: "Points for and against",
  subtitle: "AFC, 2024 regular season",
  caption: "Buffalo scored the most points of these eight teams, New England the fewest",
  captionRule: true,
  sourceNote: "Source: nflverse",
});
