import { createCanvas } from "@napi-rs/canvas";
import { SUPER_BOWL_LIX_WP } from "@sportsdataverse/examples/data";
import { matchupColors } from "@sportsdataverse/sdvplot";
import { Chart, registerables } from "chart.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Chart.js: Super Bowl LIX win probability in the matchup's two colours (a PNG in Node)",
  tags: ["node", "chartjs", "matchupColors", "png", "nfl"],
} satisfies ExampleMeta;

// Two colours that read apart and on a light page: Philadelphia (home) first, as on Game on Paper.
const { light } = await matchupColors("PHI", "KC", { league: "nfl" });
const [phi, kc] = light;
const line = (label: string, color: string, wp: (p: number) => number) => ({
  label,
  data: SUPER_BOWL_LIX_WP.map((p) => ({ x: p.minute, y: wp(p.home_wp) })),
  borderColor: color,
  backgroundColor: color,
  borderWidth: 2,
  pointRadius: 0,
});

Chart.register(...registerables);
const canvas = createCanvas(640, 320);
// Chart.js types want a DOM canvas; @napi-rs/canvas has the same 2D context. Outside a DOM, Chart.js draws
// synchronously on its BasicPlatform (no resize, no events).
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
new Chart(ctx, {
  type: "line",
  data: {
    datasets: [line("Philadelphia", phi, (wp) => wp), line("Kansas City", kc, (wp) => 1 - wp)],
  },
  options: {
    responsive: false,
    animation: false,
    scales: {
      x: {
        type: "linear",
        min: 0,
        max: 60,
        ticks: { stepSize: 15 },
        title: { display: true, text: "Minutes played" },
      },
      y: { min: 0, max: 1, ticks: { callback: (v) => `${Math.round(Number(v) * 100)}%` } },
    },
  },
});

const png = canvas.toBuffer("image/png").toString("base64");
export default `<img src="data:image/png;base64,${png}" width="640" height="320" alt="Super Bowl LIX win probability, Philadelphia and Kansas City, by minute">`;
