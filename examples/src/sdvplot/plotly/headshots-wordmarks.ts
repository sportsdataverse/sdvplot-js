import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { withHeadshots, withWordmarks } from "@sportsdataverse/sdvplot/plotly";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Plotly: wins by team, the quarterback on top, the wordmark inside (the figure for Plotly.newPlot)",
  tags: ["plotly", "withHeadshots", "withWordmarks", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Each image sits at a row's (x, y): the headshot just above the bar, the wordmark halfway up it.
const rows = [...STANDINGS]
  .sort((a, b) => b.wins - a.wins)
  .map((s) => ({ ...s, qb_y: s.wins + 1.7, mark_y: s.wins / 2 }));
const figure = {
  data: [
    { type: "bar", x: rows.map((r) => r.team), y: rows.map((r) => r.wins), marker: { color: "#e8e8e8" } },
  ],
  layout: { width: 560, height: 360, yaxis: { range: [0, 18] } },
};
const headshots = withHeadshots(figure, rows, {
  league: "nfl",
  x: "team",
  y: "qb_y",
  player: "qb_espn_id",
  height: 0.14,
});

// plotly.js loads each layout image itself, so the gallery shows the figure for Plotly.newPlot(div, data, layout).
export default withWordmarks(headshots, rows, {
  league: "nfl",
  x: "team",
  y: "mark_y",
  team: "team",
  height: 0.05,
});
