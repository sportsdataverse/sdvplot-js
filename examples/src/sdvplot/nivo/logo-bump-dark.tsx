import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { LogoBump } from "@sportsdataverse/sdvplot/react";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "nivo: <LogoBump>, the AFC West's 2024 division ranks on a dark background",
  tags: ["react", "nivo", "bump", "LogoBump", "dark mode", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// The AFC West, picked by team from the week-by-week results (a margin per game; null is the bye). The rank after
// each week: most wins so far (a tie counts half), then the best point differential, then the name.
const west = ["KC", "LAC", "DEN", "LV"].map((team) => {
  const season = AFC_WEEKS_2024.find((s) => s.team === team);
  if (season === undefined) throw new Error(`no 2024 weeks for ${team}`);
  return season;
});
const ranks = Array.from({ length: 18 }, (_, week) => {
  const records = west.map((s) => {
    const played = s.margins.slice(0, week + 1).filter((m): m is number => m !== null);
    const wins = played.reduce((n, m) => n + (m > 0 ? 1 : m === 0 ? 0.5 : 0), 0);
    return { team: s.team, wins, diff: played.reduce((n, m) => n + m, 0) };
  });
  records.sort((a, b) => b.wins - a.wins || b.diff - a.diff || a.team.localeCompare(b.team));
  return records.map((r) => r.team);
});
const data = west.map((s) => ({
  id: s.team,
  data: ranks.map((order, week) => ({ x: week + 1, y: order.indexOf(s.team) + 1 })),
}));

const background = "#181a1b";
export default (
  <LogoBump
    league="nfl"
    data={data}
    // the line colours keep 3:1 against the background and stay apart from each other
    background={background}
    logoHeight={0.14}
    width={640}
    height={300}
    animate={false}
    margin={{ top: 24, right: 48, bottom: 40, left: 40 }}
    lineWidth={4}
    pointSize={0}
    endLabel={false}
    axisTop={null}
    axisBottom={{ legend: "week", legendPosition: "middle", legendOffset: 32 }}
    axisLeft={{ legend: "rank", legendPosition: "middle", legendOffset: -32 }}
    theme={{ background, text: { fill: "#e3e3e3" }, grid: { line: { stroke: "#3a3d3f" } } }}
  />
);
