import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { gridTables } from "@sportsdataverse/sdvtables/export";
import { prepare } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "gridTables: small multiples on one page (gt_grid)",
  tags: ["node", "table", "export", "gridTables", "nfl"],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.logo("team", { league: "nfl" }),
    c.int("wins"),
    c.int("losses"),
    c.int("pf", { label: "PF" }),
  ])
  .theme("athletic")
  .build();
await prepare(spec);
// HTML, no browser needed; htmlToPNG(page) is the PNG (Chromium, see the export guide)
export default gridTables(
  [
    { spec, rows: STANDINGS.filter((r) => r.division === "West") },
    { spec, rows: STANDINGS.filter((r) => r.division === "East") },
  ],
  { ncol: 2, labels: ["AFC West", "AFC East"], title: "AFC by division", subtitle: "2024 regular season" },
);
