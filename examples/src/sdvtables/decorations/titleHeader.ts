import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "titleHeader: kicker, title, subtitle and date",
  tags: ["decoration", "titleHeader", "gt_title_header"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.int("losses")])
  .titleHeader("AFC standings", {
    kicker: "NFL 2024",
    subtitle: "East and West divisions",
    date: "Final, week 18",
  })
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
