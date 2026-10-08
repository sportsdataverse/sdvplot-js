import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "renderHTMLAsync: prepare and render in one call",
  tags: ["table", "renderHTMLAsync", "prepare", "nfl"],
} satisfies ExampleMeta;

// renderHTMLAsync(spec, rows) is await prepare(spec) then renderHTML(spec, rows): use it where you can await.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl", includeName: true }),
    c.headshot("qb_espn_id", { league: "nfl", label: "QB" }),
    c.text("qb", { label: "" }),
    c.int("wins"),
    c.int("losses"),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
