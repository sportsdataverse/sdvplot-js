import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "caption538: a ruled note and a source line",
  tags: ["decoration", "caption538", "gt_538_caption"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.int("losses")])
  .title("AFC, 2024")
  .caption538({ top: "Kansas City lost two games all season.", bottom: "SOURCE: NFLVERSE" })
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
