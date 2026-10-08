import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "headshot: player headshots from ESPN ids",
  tags: ["kind", "headshot", "gt_sdv_headshots", "reactable_sdv_headshots", "nfl"],
} satisfies ExampleMeta;

// ESPN headshot URLs are built from the id alone: no shard to load.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.headshot("qb_espn_id", { league: "nfl", label: "" }),
    c.text("qb", { label: "Quarterback" }),
    c.text("team"),
  ])
  .title("AFC starting quarterbacks, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
