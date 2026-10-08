import type { Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "A TableSpec is plain data",
  tags: ["table", "defineTable", "TableSpec", "nfl"],
} satisfies ExampleMeta;

// defineTable<Row>() checks every key against the row type; build() validates once and returns a plain object
// that JSON can carry (server to browser, a file, a cache key). Rendering is a separate step.
export default defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.int("wins"),
    c.int("losses"),
    c.colorPills("net_epa", { label: "Net EPA/play", digits: 3, domain: [-0.2, 0.2] }),
  ])
  .theme("midnight")
  .title("AFC, 2024")
  .build();
