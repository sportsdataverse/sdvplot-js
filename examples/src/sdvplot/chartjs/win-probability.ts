import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts, type Image, createCanvas, loadImage } from "@napi-rs/canvas";
import { SUPER_BOWL_LIX_WP } from "@sportsdataverse/examples/data";
import { matchupColors } from "@sportsdataverse/sdvplot";
import { logoWatermarks } from "@sportsdataverse/sdvplot/chartjs";
import { Chart, registerables } from "chart.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Chart.js: Super Bowl LIX win probability in the matchup's two colours, logos watermarked (a PNG in Node)",
  tags: ["node", "network", "chartjs", "matchupColors", "logoWatermarks", "loadImage", "png", "nfl"],
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
// A build server may have no system fonts (Vercel's has none): register a bundled one before drawing, or every
// label is blank. Source Sans 3, SIL Open Font License (examples/fonts/OFL.txt).
const font = join(dirname(fileURLToPath(import.meta.url)), "../../../fonts/SourceSans3-Regular.ttf");
if (!GlobalFonts.registerFromPath(font, "Source Sans 3")) throw new Error(`no font at ${font}`);
Chart.defaults.font.family = "Source Sans 3";
// In Node the image plugins load marks through `loadImage`: fetch each URL and decode it on @napi-rs/canvas (whose
// own loadImage(url) also fetches by itself). Keep the promises: once they settle, the plugins have redrawn.
const loads: Promise<Image>[] = [];
const load = (url: string): Promise<Image> => {
  const p = fetch(url)
    .then((r) => r.arrayBuffer())
    .then((b) => loadImage(Buffer.from(b)));
  loads.push(p);
  return p;
};
const canvas = createCanvas(640, 320);
// Chart.js types want a DOM canvas; @napi-rs/canvas has the same 2D context. Outside a DOM, Chart.js draws
// synchronously on its BasicPlatform (no resize, no events).
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const chart = new Chart(ctx, {
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
  // Game on Paper's watermarks: the home team top-left, the away team bottom-left, 40% opaque behind the lines
  plugins: [logoWatermarks(["PHI", "KC"], { league: "nfl", size: 60, loadImage: load })],
});
await Promise.all(loads);

const png = canvas.toBuffer("image/png").toString("base64");
chart.destroy();
export default `<img src="data:image/png;base64,${png}" width="640" height="320" alt="Super Bowl LIX win probability, Philadelphia and Kansas City, by minute, with faint Eagles and Chiefs logos behind the lines">`;
