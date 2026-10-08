import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { withLogos } from "@sportsdataverse/sdvplot/plotly";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Plotly: points for and against, with team logos (the figure for Plotly.newPlot)",
  tags: ["plotly", "withLogos", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const rows = STANDINGS.map((s) => ({ ...s }));
const figure = {
  data: [{ type: "scatter", mode: "markers", x: rows.map((r) => r.pf), y: rows.map((r) => r.pa) }],
  layout: { width: 560, height: 400, xaxis: { range: [260, 550] }, yaxis: { range: [280, 460] } },
};

// Each logo is one entry of layout.images, which plotly.js loads itself.
const logos = withLogos(figure, rows, { league: "nfl", x: "pf", y: "pa", team: "team", height: 0.12 });
// In the browser: Plotly.newPlot(div, data, layout), as this page does. Without JavaScript the page shows the figure.
export const browser = {
  lib: "plotly",
  figure: logos,
  label: "2024 AFC points for against points against, each team drawn as its logo",
} as const;

export default logos;
