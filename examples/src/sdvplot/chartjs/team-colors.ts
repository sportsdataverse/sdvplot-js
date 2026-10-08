import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts, createCanvas } from "@napi-rs/canvas";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColor, teamFill } from "@sportsdataverse/sdvplot/chartjs";
import { Chart, type ChartConfiguration, registerables } from "chart.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Chart.js: points for and against, in team colours (a PNG in Node)",
  tags: ["node", "chartjs", "teamColor", "teamFill", "png", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const teams = STANDINGS.map((s) => s.team);

// One config for the browser and for Node, built fresh per chart (Chart.js keeps state on what it is given).
const config = (): ChartConfiguration<"bar"> => ({
  type: "bar",
  data: {
    labels: teams,
    datasets: [
      // one colour per bar: teamColor for the solid points-for bars, teamFill (0.2 opacity) under the outlined ones
      { label: "Points for", data: STANDINGS.map((s) => s.pf), backgroundColor: teamColor(teams, "nfl") },
      {
        label: "Points against",
        data: STANDINGS.map((s) => s.pa),
        backgroundColor: teamFill(teams, "nfl"),
        borderColor: teamColor(teams, "nfl"),
        borderWidth: 2,
      },
    ],
  },
  options: { responsive: false, animation: false, plugins: { legend: { display: false } } },
});
// In the browser: new Chart(canvas, config()) on a 640 x 320 canvas, as this page does.
export const browser = {
  lib: "chartjs",
  config,
  width: 640,
  height: 320,
  label: "2024 AFC points for (solid) and against (outlined) by team",
} as const;

Chart.register(...registerables);
// A build server may have no system fonts (Vercel's has none): register a bundled one before drawing, or every
// label is blank. Source Sans 3, SIL Open Font License (examples/fonts/OFL.txt).
const font = join(dirname(fileURLToPath(import.meta.url)), "../../../fonts/SourceSans3-Regular.ttf");
if (!GlobalFonts.registerFromPath(font, "Source Sans 3")) throw new Error(`no font at ${font}`);
Chart.defaults.font.family = "Source Sans 3";
const canvas = createCanvas(browser.width, browser.height);
new Chart(canvas.getContext("2d") as unknown as CanvasRenderingContext2D, config());

const png = canvas.toBuffer("image/png").toString("base64");
export default `<img src="data:image/png;base64,${png}" width="640" height="320" alt="${browser.label}">`;
