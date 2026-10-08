import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = { title: "int: whole numbers", tags: ["kind", "int"] } satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.int("wins", { label: "W" }),
    c.int("losses", { label: "L" }),
    c.int("pf", { label: "PF" }),
    c.int("pa", { label: "PA" }),
  ])
  .title("AFC, 2024")
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
