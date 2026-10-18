import { NBA_STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColorway, withAxisLogos } from "@sportsdataverse/sdvplot/plotly";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Plotly: the 2023-24 Pacific Division's wins as horizontal bars, logos down the y axis, named by nickname (the figure for Plotly.newPlot)",
  tags: ["plotly", "withAxisLogos", "teamColorway", "basketball", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");
// stats.nba.com's TeamName is the nickname ("Clippers"): sdvplot resolves it like an abbreviation.
const teams = NBA_STANDINGS.map((s) => s.team);
const figure = {
  data: [
    {
      type: "bar",
      orientation: "h",
      y: teams,
      x: NBA_STANDINGS.map((s) => s.wins),
      marker: { color: teamColorway("nba", teams) },
    },
  ],
  layout: {
    width: 560,
    height: 360,
    xaxis: { title: { text: "Wins (2023-24)" } },
    // first place on top: a category axis runs bottom to top, so give it a descending range (categories are 0, 1, ...)
    yaxis: { range: [teams.length - 0.5, -0.5] },
  },
};

// On the y axis the logos sit left of the plot, one per category band; the tick labels are hidden, not blanked.
const logos = withAxisLogos(figure, "y", { league: "nba", height: 0.15 });
// In the browser: Plotly.newPlot(div, data, layout), as this page does. Without JavaScript the page shows the figure.
export const browser = {
  lib: "plotly",
  figure: logos,
  label:
    "The 2023-24 Pacific Division's wins, first place on top: the Clippers, Suns, Lakers, Kings and Warriors, each bar in its team's colour with its logo beside it",
} as const;

export default logos;
