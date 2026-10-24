import { KC_PHI_GAMES_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { LogoPoint } from "@sportsdataverse/sdvplot/react";
import { teamTheme } from "@sportsdataverse/sdvplot/victory";
import { VictoryAxis, VictoryBar, VictoryChart, VictoryScatter, VictoryTheme } from "victory";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Victory: the Chiefs' 2024 scoring margins, each game's opponent as a logo point",
  tags: ["react", "victory", "bar", "scatter", "LogoPoint", "teamTheme", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Kansas City's 17 regular-season games: the margin (Chiefs' points less the opponent's) and who they played.
const games = KC_PHI_GAMES_2024.filter((g) => g.home_team === "KC" || g.away_team === "KC").map((g) => {
  const home = g.home_team === "KC";
  return {
    week: g.week,
    margin: home ? g.home_score - g.away_score : g.away_score - g.home_score,
    opponent: home ? g.away_team : g.home_team,
  };
});
if (games.length !== 17) throw new Error(`expected 17 Chiefs games, got ${games.length}`);

export default (
  // teamTheme over Victory's clean theme: a lone bar series takes the first team's colour, the Chiefs' red
  <VictoryChart
    theme={teamTheme({ league: "nfl", teams: ["KC"], base: VictoryTheme.clean })}
    width={640}
    height={320}
    domainPadding={{ x: 20, y: 24 }}
    padding={{ top: 24, right: 24, bottom: 48, left: 56 }}
  >
    <VictoryAxis label="week" tickValues={games.map((g) => g.week)} offsetY={48} />
    <VictoryAxis dependentAxis label="scoring margin" />
    <VictoryBar data={games} x="week" y="margin" barWidth={14} />
    {/* each opponent's logo at the end of its bar: 2 x size px tall */}
    <VictoryScatter
      data={games}
      x="week"
      y="margin"
      size={10}
      dataComponent={<LogoPoint league="nfl" team="opponent" />}
    />
  </VictoryChart>
);
