import { NBA_STANDINGS, NHL_STANDINGS, STANDINGS } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { gridTables } from "@sportsdataverse/sdvtables/export";
import { renderHTMLAsync } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "gridTables across leagues: NBA, NHL and NFL tables on one page, from HTML strings",
  tags: ["node", "table", "export", "gridTables", "multi-league", "nba", "nhl", "nfl"],
} satisfies ExampleMeta;

// Three row types cannot share one spec, so each table is rendered first and handed over as an HTML string;
// gridTables accepts strings and specs alike. One theme keeps the page consistent.
const nba = defineTable<(typeof NBA_STANDINGS)[number]>()
  .columns((c) => [
    c.logo("team", { league: "nba", label: "" }),
    c.int("wins", { label: "W" }),
    c.int("losses", { label: "L" }),
  ])
  .theme("athletic")
  .build();
const nhl = defineTable<(typeof NHL_STANDINGS)[number]>()
  .columns((c) => [c.logo("team", { league: "nhl", label: "" }), c.int("points", { label: "Pts" })])
  .theme("athletic")
  .build();
const nfl = defineTable<(typeof STANDINGS)[number]>()
  .columns((c) => [
    c.logo("team", { league: "nfl", label: "" }),
    c.int("wins", { label: "W" }),
    c.int("losses", { label: "L" }),
  ])
  .theme("athletic")
  .build();
// htmlToPNG(page) is the PNG of this page (Chromium, see the export guide)
export default gridTables(
  [
    await renderHTMLAsync(nba, NBA_STANDINGS),
    await renderHTMLAsync(nhl, NHL_STANDINGS.slice(0, 5)),
    await renderHTMLAsync(
      nfl,
      STANDINGS.filter((r) => r.division === "West"),
    ),
  ],
  {
    ncol: 3,
    gap: 32,
    labels: ["NBA Pacific, 2023-24", "NHL Atlantic top five, 2025-26", "AFC West, 2024"],
    title: "Three divisions, three leagues",
    caption: "Final regular-season standings",
    captionRule: true,
    sourceNote: "Sources: stats.nba.com, NHL api-web, nflverse",
  },
);
