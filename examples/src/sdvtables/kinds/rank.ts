import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "rank: ordinals with a superscript suffix",
  tags: ["kind", "rank", "gt_fmt_rank"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.text("team"), c.rank("srs_rank", { label: "SRS rank" })])
  .title("AFC, 2024: league-wide SRS rank")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
