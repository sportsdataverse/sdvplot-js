import * as Plot from "@observablehq/plot";
import { KC_PHI_GAMES_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos, teamColor } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Rolling form: 4-game average point margin, Chiefs and Eagles, 2024 (Plot.windowY + selectLast)",
  tags: ["plot", "windowY", "selectLast", "logos", "teamColor", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");

// one row per team per game, from that team's side of the score
const games = KC_PHI_GAMES_2024.flatMap((g) =>
  (["KC", "PHI"] as const).flatMap((team) =>
    g.home_team === team
      ? [{ team, week: g.week, margin: g.home_score - g.away_score }]
      : g.away_team === team
        ? [{ team, week: g.week, margin: g.away_score - g.home_score }]
        : [],
  ),
);
const rolling = { k: 4, anchor: "end" } as const;
export default Plot.plot({
  width: 640,
  height: 320,
  x: { label: "Week →" },
  y: { label: "↑ Point margin, 4-game average", grid: true },
  color: teamColor("nfl", { values: ["KC", "PHI"], legend: true }),
  marks: [
    Plot.ruleY([0]),
    Plot.lineY(games, Plot.windowY(rolling, { x: "week", y: "margin", stroke: "team", tip: true })),
    // the same rolling value, last week only: each team's logo labels its own line
    logos(
      games,
      Plot.selectLast(
        Plot.windowY(rolling, {
          league: "nfl",
          team: "team",
          x: "week",
          y: "margin",
          z: "team",
          height: 0.09,
        }),
      ),
    ),
  ],
});
