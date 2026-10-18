import { NBA_STANDINGS } from "@sportsdataverse/examples/data";
import { createTable, defineTable } from "@sportsdataverse/sdvtables";
import { hydrate, prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "NBA standings: logos, team-colour bars and coloured ranks, sortable and filterable",
  tags: ["table", "recipe", "interactive", "logo", "teamColorBar", "colorRanks", "pct", "nba"],
} satisfies ExampleMeta;

// The Pacific Division, 2023-24: games behind the leader and win % are derived from the captured wins and losses.
const lead = NBA_STANDINGS[0];
const rows = NBA_STANDINGS.map((r) => ({
  logo: r.team,
  team: r.team,
  city: r.city,
  wins: r.wins,
  losses: r.losses,
  win_pct: r.wins / (r.wins + r.losses),
  gb: lead ? (lead.wins - r.wins + (r.losses - lead.losses)) / 2 : 0,
}));
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [
    c.logo("logo", { league: "nba", label: "", sortable: false }),
    c.teamColorBar("team", { league: "nba", label: "Team", barWidth: 6 }),
    c.text("city", { filterable: true }),
    c.colorRanks("wins", { label: "W" }),
    c.int("losses", { label: "L" }),
    c.pct("win_pct", { label: "Win %" }),
    c.num("gb", { label: "GB", digits: 1 }),
  ])
  .title("Pacific Division")
  .subtitle("2023-24 NBA regular season, final")
  .sourceNote("Source: stats.nba.com leaguestandingsv3")
  .theme("athletic")
  .rowKey("team")
  .build();
await prepare(spec);
// click a header to sort, type in the City box to filter
const table = createTable(spec, rows, { sort: { col: "win_pct", dir: "desc" } });
const host = document.createElement("div");
host.innerHTML = renderHTML(table);
hydrate(host.querySelector(".sdvt") as Element, table);
export default host;
