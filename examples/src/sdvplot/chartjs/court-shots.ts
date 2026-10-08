import { createCanvas } from "@napi-rs/canvas";
import { NBA_SHOTS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColor } from "@sportsdataverse/sdvplot/chartjs";
import { surface } from "@sportsdataverse/sdvplot/chartjs/surface";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import { Chart, registerables } from "chart.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Chart.js: LAL at DEN's fourth-quarter shots over a Nuggets-painted court (a PNG in Node)",
  tags: ["node", "chartjs", "surface", "teamColor", "toSurfaceFrame", "png", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");

// The Plot shot chart's stats.nba.com shots (x_legacy/y_legacy, tenths of a foot from the hoop), in court feet.
const shots = toSurfaceFrame(NBA_SHOTS, { from: "nba-legacy" });
const court = surface("nba", { team: "DEN", displayRange: "defense" });
// made shots filled in the shooting team's colour, misses white with a ring in it: both read on the wood and the paint
const color = teamColor(
  shots.map((s) => s.team),
  "nba",
);

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
        backgroundColor: color.map((c, i) => (shots[i]?.made ? c : "#ffffff")),
        borderColor: color.map((c, i) => (shots[i]?.made ? "#ffffff" : c)),
        borderWidth: 2,
        pointRadius: 7,
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
export default `<img src="data:image/png;base64,${png}" width="${canvas.width}" height="${canvas.height}" alt="The 38 fourth-quarter shots of the Lakers at the Nuggets, 24 October 2023, on the defensive half of a Nuggets-painted court: made shots filled in the team colour, misses white">`;
