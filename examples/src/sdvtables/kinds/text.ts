import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = { title: "text: a value as written", tags: ["kind", "text"] } satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.text("qb", { label: "Quarterback" }),
    c.text("division", { align: "center" }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
