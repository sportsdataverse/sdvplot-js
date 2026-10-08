import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColorway, withAxisLogos } from "@sportsdataverse/sdvplot/plotly";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Plotly: wins by team, logos on the axis, team-coloured bars (the figure for Plotly.newPlot)",
  tags: ["plotly", "withAxisLogos", "teamColorway", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const teams = [...STANDINGS].sort((a, b) => b.wins - a.wins).map((s) => s.team);
const figure = {
  data: [
    {
      type: "bar",
      x: teams,
      y: teams.map((t) => STANDINGS.find((s) => s.team === t)?.wins),
      // one colour per bar; as `layout.colorway`, Plotly would cycle them per trace instead
      marker: { color: teamColorway("nfl", teams) },
    },
  ],
  layout: { width: 560, height: 360 },
};

// The axis keeps its categories; their labels are blanked and a layout image sits under each tick.
export default withAxisLogos(figure, "x", { league: "nfl", height: 0.1 });
