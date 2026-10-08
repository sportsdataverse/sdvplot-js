import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "watermark: faint text behind the rows",
  tags: ["decoration", "watermark", "gt_watermark"],
} satisfies ExampleMeta;

// text becomes an inline SVG background; pass image (a URL) instead for a logo.
const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.text("qb"), c.int("wins"), c.int("losses")])
  .watermark({ text: "SAMPLE", angle: -20, opacity: 0.08 })
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
