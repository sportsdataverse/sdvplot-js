import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { createTable, defineTable } from "@sportsdataverse/sdvtables";
import { hydrate, prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "AFC quarterbacks on a dark theme: headshots, a spotlight and division accents",
  tags: [
    "table",
    "recipe",
    "interactive",
    "midnight",
    "headshot",
    "mergeStackTeamColor",
    "colorPills",
    "spotlight",
    "rowAccent",
    "nfl",
  ],
} satisfies ExampleMeta;

const spec = defineTable<Standing>()
  .columns((c) => [
    c.headshot("qb_espn_id", { league: "nfl", label: "", sortable: false }),
    // color: the top line, black by default, in midnight's text colour
    c.mergeStackTeamColor("qb", "team", "team", { league: "nfl", label: "Quarterback", color: "#E8E9ED" }),
    c.text("division"),
    c.tally(["wins", "losses"], { label: "W-L" }),
    c.rank("srs_rank", { label: "SRS rank" }),
    c.colorPills("net_epa", { label: "Net EPA/play", digits: 3, domain: [-0.2, 0.2], naColor: "#3A3D45" }),
    c.text("result_last", { label: "Week 18", align: "center" }),
  ])
  // the division column becomes a coloured left edge (and is hidden); Buffalo is lit, the rest dimmed
  .rowAccent("division", { palette: { East: "#5B8DEF", West: "#E8A33D" }, width: 5 })
  .spotlight({ key: "team", op: "==", value: "BUF" }, { accentColor: "#C60C30" })
  .titleHeader("Josh Allen's Bills, and the rest of the AFC East and West", {
    kicker: "NFL 2024",
    subtitle:
      "Starting quarterback, record, league-wide SRS rank and net EPA per play; East rows edged blue, West amber",
  })
  .sourceNote(
    "Source: nflverse games, players and play_by_play_2024. New England's net EPA is blanked in the sample data.",
  )
  .theme("midnight")
  .rowKey("team")
  .build();
await prepare(spec);
const table = createTable(spec, STANDINGS, { sort: { col: "srs_rank", dir: "asc" } });
const host = document.createElement("div");
host.innerHTML = renderHTML(table);
hydrate(host.querySelector(".sdvt") as Element, table);
export default host;
