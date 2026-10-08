import { STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "A standings table as an HTML string",
  tags: ["table", "renderHTML", "nfl"],
} satisfies ExampleMeta;

export const spec = defineTable<(typeof STANDINGS)[number]>()
  .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.int("losses")])
  .title("AFC, 2024")
  .build();
await prepare(spec); // loads the NFL shard renderHTML needs; renderHTML itself is synchronous
export default renderHTML(spec, STANDINGS);
