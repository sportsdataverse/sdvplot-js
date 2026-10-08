import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { stackTables } from "@sportsdataverse/sdvtables/export";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "stackTables: tables one above the other (gt_stack_tables)",
  tags: ["node", "table", "export", "stackTables", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [c.text("team"), c.text("qb", { label: "Quarterback" }), c.int("wins"), c.int("losses")])
  .theme("pl")
  .build();
// one spec used twice: each copy gets its own id, so each keeps its decorations
export default stackTables(
  [
    { spec, rows: STANDINGS.filter((r) => r.division === "West") },
    { spec, rows: STANDINGS.filter((r) => r.division === "East") },
  ],
  { title: "AFC, 2024", caption: "West above, East below", sourceNote: "Source: nflverse" },
);
