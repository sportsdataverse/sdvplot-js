import { createCanvas } from "@napi-rs/canvas";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColor, teamFill } from "@sportsdataverse/sdvplot/chartjs";
import { Chart, registerables } from "chart.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Chart.js: points for and against, in team colours (a PNG in Node)",
  tags: ["node", "chartjs", "teamColor", "teamFill", "png", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const teams = STANDINGS.map((s) => s.team);

Chart.register(...registerables);
const canvas = createCanvas(640, 320);
new Chart(canvas.getContext("2d") as unknown as CanvasRenderingContext2D, {
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

const png = canvas.toBuffer("image/png").toString("base64");
export default `<img src="data:image/png;base64,${png}" width="640" height="320" alt="2024 AFC points for (solid) and against (outlined) by team">`;
