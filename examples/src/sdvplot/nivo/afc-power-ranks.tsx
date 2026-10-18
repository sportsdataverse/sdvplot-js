import { Bump } from "@nivo/bump";
import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoLayer, teamColors } from "@sportsdataverse/sdvplot/nivo";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "nivo: the AFC East's and West's 2024 power ranks week by week, a logo at the end of each line",
  tags: ["react", "nivo", "bump", "logoLayer", "teamColors", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// The rank after each week, from the week-by-week results (a margin per game; null is the bye): most wins so far (a
// tie counts half), then the best point differential, then the name. A plain ranking, not the NFL's tiebreakers.
const ranks = Array.from({ length: 18 }, (_, week) => {
  const records = AFC_WEEKS_2024.map(({ team, margins }) => {
    const played = margins.slice(0, week + 1).filter((m): m is number => m !== null);
    const wins = played.reduce((n, m) => n + (m > 0 ? 1 : m === 0 ? 0.5 : 0), 0);
    return { team, wins, diff: played.reduce((n, m) => n + m, 0) };
  });
  records.sort((a, b) => b.wins - a.wins || b.diff - a.diff || a.team.localeCompare(b.team));
  return records.map((r) => r.team);
});
// One nivo series per team, picked by its id: its rank in each week.
const data = AFC_WEEKS_2024.map(({ team }) => ({
  id: team,
  data: ranks.map((order, week) => ({ x: week + 1, y: order.indexOf(team) + 1 })),
}));

export default (
  <Bump
    width={640}
    height={360}
    data={data}
    animate={false}
    margin={{ top: 24, right: 48, bottom: 40, left: 40 }}
    // each series' id is a team: its line in the team's colour. Three of these eight wear navy, so pass the chart's
    // background and every team: each colour then reads (3:1) and stays apart from the others
    colors={teamColors({ league: "nfl", teams: AFC_WEEKS_2024.map((t) => t.team), background: "#ffffff" })}
    lineWidth={3}
    pointSize={6}
    endLabel={false}
    axisTop={null}
    axisBottom={{ legend: "week", legendPosition: "middle", legendOffset: 32 }}
    axisLeft={{ legend: "rank", legendPosition: "middle", legendOffset: -32 }}
    // after the built-in layers: a logo at each line's last point, a tenth of the plot tall
    layers={["grid", "axes", "lines", "points", logoLayer({ league: "nfl", height: 0.1 })]}
  />
);
