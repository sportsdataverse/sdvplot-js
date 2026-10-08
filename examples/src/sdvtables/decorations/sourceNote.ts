import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "sourceNote: a footnote under the table",
  tags: ["decoration", "sourceNote"],
} satisfies ExampleMeta;

// The note is escaped unless you mark it unsafe (then it is inserted as HTML: only for markup you wrote).
const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.int("pf", { label: "PF" }),
    c.int("pa", { label: "PA" }),
  ])
  .title("AFC, 2024")
  .sourceNote('Data: <a href="https://nflverse.nflverse.com">nflverse</a>', { unsafe: true })
  .build();
export default await renderHTMLAsync(spec, STANDINGS);
