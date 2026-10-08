import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "wordmark: team wordmarks",
  tags: ["kind", "wordmark", "gt_sdv_wordmarks", "reactable_sdv_wordmarks", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.wordmark("team", { league: "nfl", label: "Team", height: 24 }),
    c.int("wins"),
    c.int("losses"),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
