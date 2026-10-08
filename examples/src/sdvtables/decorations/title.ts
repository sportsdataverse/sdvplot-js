import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "title: the table caption",
  tags: ["decoration", "title"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.int("losses")])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
