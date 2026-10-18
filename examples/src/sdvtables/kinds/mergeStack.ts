import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "mergeStack: two columns in one cell, with a headshot",
  tags: ["kind", "mergeStack", "merge_column", "reactablefmtr", "nfl"],
} satisfies ExampleMeta;

// reactablefmtr merge_column: the quarterback with his division below, each in its own size, colour and weight.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.mergeStack("qb", "division", {
      label: "Quarterback",
      position: "below",
      mark: "headshot",
      markKey: "qb_espn_id",
      league: "nfl",
      markHeight: 32,
    }),
    c.int("wins"),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
