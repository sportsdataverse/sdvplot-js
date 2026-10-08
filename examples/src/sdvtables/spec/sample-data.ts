import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The sample rows every table example uses",
  tags: ["table", "STANDINGS", "sample data", "nfl"],
} satisfies ExampleMeta;

// One text column per field, labelled with the field name, so the page shows the rows exactly as stored.
const fields = Object.keys(STANDINGS[0] ?? {}) as (keyof Standing)[];
const spec = defineTable<Standing>()
  .columns((c) => fields.map((k) => c.text(k, { label: k })))
  .title("STANDINGS: eight AFC teams, 2024 regular season")
  .sourceNote('import { STANDINGS } from "@sportsdataverse/examples/data"')
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
