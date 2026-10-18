import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { withLogos } from "@sportsdataverse/sdvplot/plotly";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Plotly: all 32 teams' 2024 offensive and defensive EPA per play, as logos over hover points (the figure for Plotly.newPlot)",
  tags: ["plotly", "withLogos", "epa", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const rows = NFL_TEAM_EPA_2024.map((t) => ({
  team: t.team,
  off: t.off_epa / t.off_plays,
  def: t.def_epa / t.def_plays,
}));
const figure = {
  data: [
    {
      type: "scatter",
      mode: "markers",
      x: rows.map((r) => r.off),
      y: rows.map((r) => r.def),
      text: rows.map((r) => r.team),
      hovertemplate: "%{text}<br>offence %{x:.3f}<br>defence %{y:.3f}<extra></extra>",
      // invisible markers under the logos: layout images take no hover, the trace does
      marker: { size: 24, opacity: 0 },
    },
  ],
  layout: {
    width: 600,
    height: 480,
    xaxis: { title: { text: "Offensive EPA per play" }, range: [-0.25, 0.25] },
    // a descending range reverses the axis: a good defence allows negative EPA, so the best teams sit top right
    yaxis: { title: { text: "Defensive EPA per play allowed" }, range: [0.18, -0.12] },
  },
};

// The images follow the axes as Plotly draws them, the reversed y axis included.
const logos = withLogos(figure, rows, { league: "nfl", x: "off", y: "def", team: "team", height: 0.07 });
// In the browser: Plotly.newPlot(div, data, layout), as this page does. Without JavaScript the page shows the figure.
export const browser = {
  lib: "plotly",
  figure: logos,
  label:
    "Every NFL team's 2024 offensive EPA per play against defensive EPA per play allowed, each team drawn as its logo, the best teams top right",
} as const;

export default logos;
