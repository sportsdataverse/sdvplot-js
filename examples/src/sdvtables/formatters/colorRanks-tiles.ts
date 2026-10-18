import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "colorRanks: color_tiles options (span, bias, evenBreaks, showText)",
  tags: ["formatter", "colorRanks", "color_tiles", "color_scales", "reactablefmtr"],
} satisfies ExampleMeta;

// span puts points for and against on one scale; bias spreads the high end; evenBreaks deals the palette out in
// equal-count buckets; showText: false keeps only the colour.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.colorRanks("pf", { label: "PF", span: ["pf", "pa"], bias: 1.5, palette: ["#FFFFFF", "#15607A"] }),
    c.colorRanks("pa", { label: "PA", span: ["pf", "pa"], bias: 1.5, palette: ["#FFFFFF", "#15607A"] }),
    c.colorRanks("srs_rank", { label: "SRS rank", evenBreaks: true }),
    c.colorRanks("wins", { label: "Wins", showText: false, reverse: true }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
