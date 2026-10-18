import { KC_PHI_GAMES_2024 } from "@sportsdataverse/examples/data";
import { defineTable } from "@sportsdataverse/sdvtables";
import { gridTables } from "@sportsdataverse/sdvtables/export";
import { prepare } from "@sportsdataverse/sdvtables/html";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "gridTables by a group column: the Super Bowl LIX teams' seasons, side by side",
  tags: ["node", "table", "export", "gridTables", "colorResults", "logo", "nfl"],
} satisfies ExampleMeta;

// Each game from each team's side, then one table per team: the grouping batchToPNG writes as one file per team,
// laid out here on one page instead.
const games = (team: "KC" | "PHI") =>
  KC_PHI_GAMES_2024.filter((g) => g.home_team === team || g.away_team === team).map((g) => {
    const home = g.home_team === team;
    const pts = home ? g.home_score : g.away_score;
    const opp = home ? g.away_score : g.home_score;
    return {
      week: g.week,
      opponent: home ? g.away_team : g.home_team,
      score: `${pts}-${opp}`,
      result: pts > opp ? "W" : "L",
    };
  });
const spec = defineTable<ReturnType<typeof games>[number]>()
  .columns((c) => [
    c.int("week", { label: "Wk" }),
    c.logo("opponent", { league: "nfl", label: "Opp." }),
    c.text("score", { label: "Score" }),
    c.colorResults("result", { label: "" }),
  ])
  .theme("athletic", { density: "compact" })
  .build();
await prepare(spec);
// one spec, two tables: each copy gets its own id, so each keeps its own styles
export default gridTables(
  [
    { spec, rows: games("KC") },
    { spec, rows: games("PHI") },
  ],
  {
    ncol: 2,
    gap: 40,
    labels: ["Kansas City, 15-2", "Philadelphia, 14-3"],
    title: "Before Super Bowl LIX",
    subtitle: "Every 2024 regular-season game of the two finalists",
    sourceNote: "Source: nflverse games",
  },
);
