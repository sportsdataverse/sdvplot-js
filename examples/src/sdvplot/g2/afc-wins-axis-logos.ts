import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { axisLogos, teamColorScale } from "@sportsdataverse/sdvplot/g2";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "G2: 2024 AFC West and East wins, team-coloured columns, the logos as the axis labels",
  tags: ["g2", "axisLogos", "teamColorScale", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// the eight AFC teams picked by id, most wins first
const TEAMS = ["KC", "BUF", "LAC", "DEN", "MIA", "NYJ", "NE", "LV"];
const rows = TEAMS.map((team) => {
  const s = STANDINGS.find((r) => r.team === team);
  if (s === undefined) throw new Error(`${team} is not in STANDINGS`);
  return { team, wins: s.wins };
}).sort((a, b) => b.wins - a.wins);
// each column in its team's colour: G2's scale.color, keyed by the team values the data holds
const color = teamColorScale(
  "nfl",
  rows.map((r) => r.team),
);

// In the browser: new Chart({ container, width: 560, height: 360 }), chart.options(spec()), chart.render().
export const browser = {
  lib: "g2",
  spec: () => ({
    type: "interval",
    data: rows,
    encode: { x: "team", y: "wins", color: "team" },
    scale: { color },
    legend: false,
    axis: {
      // G2's labelRender: each team's label is its logo, 28 px tall, centred under its column
      x: { ...axisLogos({ league: "nfl", size: 28 }), title: false },
      y: { title: "Wins (2024)" },
    },
  }),
  width: 560,
  height: 360,
  label:
    "2024 wins for the AFC West and East, most first, each column in its team's colour with the team's logo under it: Kansas City 15, Buffalo 13, the Chargers 11, Denver 10, Miami 8, the Jets 5, New England and Las Vegas 4",
} as const;

// G2 draws only in a browser; without JavaScript the page shows each team's wins and colour
export default rows.map((r, i) => ({ ...r, color: color.range[i] }));
