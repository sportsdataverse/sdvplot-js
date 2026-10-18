import { KC_PHI_GAMES_2024 } from "@sportsdataverse/examples/data";
import { createTable, defineTable } from "@sportsdataverse/sdvtables";
import { hydrate, prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Eagles game log in the team's own colours: opponent logos, results and margins, paged",
  tags: ["table", "recipe", "interactive", "sdvTeam", "logo", "colorResults", "delta", "tally", "nfl"],
} satisfies ExampleMeta;

// Philadelphia's 17 regular-season games, from its side: the opponent, home or away, and the score.
const rows = KC_PHI_GAMES_2024.filter((g) => g.home_team === "PHI" || g.away_team === "PHI").map((g) => {
  const home = g.home_team === "PHI";
  const phi = home ? g.home_score : g.away_score;
  const opp = home ? g.away_score : g.home_score;
  return {
    week: g.week,
    opponent: home ? g.away_team : g.home_team,
    site: home ? "Home" : "Away",
    phi,
    opp,
    result: phi > opp ? "W" : phi < opp ? "L" : "T",
  };
});
const spec = defineTable<(typeof rows)[number]>()
  .columns((c) => [
    c.int("week", { label: "Wk" }),
    c.logo("opponent", { league: "nfl", includeName: true, label: "Opponent", filterable: true }),
    c.text("site", { label: "", filterable: true }),
    c.colorResults("result", { label: "" }),
    c.tally(["phi", "opp"], { label: "Score" }),
    c.delta("opp", "phi", { label: "Margin", decimals: 0, sortable: false }), // its key holds the opponent's points, not the margin
  ])
  .title("Philadelphia Eagles, 2024")
  .subtitle("Regular season: 14-3, then a Super Bowl win over Kansas City")
  .sourceNote("Source: nflverse games")
  // sdvTeam: the heading in the team's primary colour, labels in a readable one
  .theme("sdvTeam", { options: { league: "nfl", team: "PHI" } })
  .build();
await prepare(spec);
const table = createTable(spec, rows, { pageSize: 6, sort: { col: "week", dir: "asc" } });
const host = document.createElement("div");
host.innerHTML = renderHTML(table);
hydrate(host.querySelector(".sdvt") as Element, table);
export default host;
