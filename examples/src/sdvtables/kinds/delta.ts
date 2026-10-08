import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "delta: the change from one column to another",
  tags: ["kind", "delta", "gt_delta"],
} satisfies ExampleMeta;

// delta(from, to) shows to - from: here points for minus points against, green up and red down.
const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.int("pf", { label: "PF" }),
    c.delta("pa", "pf", { label: "Point diff.", decimals: 0, arrows: true }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
