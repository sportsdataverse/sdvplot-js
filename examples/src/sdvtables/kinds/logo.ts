import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "logo: team logos from the bundled league data",
  tags: ["kind", "logo", "gt_sdv_logos", "reactable_sdv_logos", "nfl"],
} satisfies ExampleMeta;

// renderHTMLAsync loads the NFL shard first; the cell holds the archive URL, nothing is fetched to render it.
const spec = defineTable<Standing>()
  .columns((c) => [c.logo("team", { league: "nfl", includeName: true }), c.text("division")])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
