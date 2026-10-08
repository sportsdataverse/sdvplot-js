import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "tally: a record, with the share of one part",
  tags: ["kind", "tally", "gt_fmt_tally"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.tally(["wins", "losses", "ties"], { label: "Record", share: true, shareOf: 0 }),
  ])
  .title("AFC, 2024: W-L-T (win share)")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
