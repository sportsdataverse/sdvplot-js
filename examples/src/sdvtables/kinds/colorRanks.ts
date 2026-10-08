import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "colorRanks: cells filled green to red",
  tags: ["kind", "colorRanks", "gt_color_ranks"],
} satisfies ExampleMeta;

// The default palette is RANK_PALETTE (green to red); reverse it when lower is better.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.colorRanks("pf", { label: "Points for", domain: [280, 530], reverse: true }),
    c.colorRanks("pa", { label: "Points against", domain: [280, 530] }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
