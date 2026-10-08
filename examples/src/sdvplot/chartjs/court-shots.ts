import { createCanvas } from "@napi-rs/canvas";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColor } from "@sportsdataverse/sdvplot/chartjs";
import { surface } from "@sportsdataverse/sdvplot/chartjs/surface";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import { Chart, registerables } from "chart.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Chart.js: a shot chart over a team-painted court (a PNG in Node)",
  tags: ["node", "chartjs", "surface", "teamColor", "toSurfaceFrame", "png", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");

// The Plot shot chart's stats.nba.com shots (x_legacy/y_legacy, tenths of a foot from the hoop), in court feet.
const shots = toSurfaceFrame(
  [
    { x_legacy: 10, y_legacy: 120, team: "LAL", made: true },
    { x_legacy: -50, y_legacy: 230, team: "BOS", made: false },
  ],
  { from: "nba-legacy" },
);
const court = surface("nba", { team: "LAL", displayRange: "defense" });
const teams = shots.map((s) => String(s.team));

Chart.register(...registerables);
const [x0, y0, x1, y1] = court.scene.bbox;
const width = 640;
const canvas = createCanvas(width, Math.round((width * (y1 - y0)) / (x1 - x0)));
new Chart(canvas.getContext("2d") as unknown as CanvasRenderingContext2D, {
  type: "scatter",
  data: {
    datasets: [
      {
        data: shots.map((s) => ({ x: Number(s.surface_x), y: Number(s.surface_y) })),
        backgroundColor: teamColor(teams, "nba"),
        // the secondary colour rings each dot, so a Lakers shot still reads on the Lakers paint
        borderColor: teamColor(teams, "nba", { which: "secondary" }),
        borderWidth: 3,
        pointRadius: 9,
      },
    ],
  },
  // court.plugin paints the court under the datasets; court.scales keeps one foot the same length on both axes
  plugins: [court.plugin],
  options: {
    responsive: false,
    animation: false,
    layout: { padding: 0 },
    plugins: { legend: { display: false } },
    scales: { x: { ...court.scales.x, display: false }, y: { ...court.scales.y, display: false } },
  },
});

const png = canvas.toBuffer("image/png").toString("base64");
export default `<img src="data:image/png;base64,${png}" width="${canvas.width}" height="${canvas.height}" alt="Two shots on the defensive half of a Lakers-painted court">`;
