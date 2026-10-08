import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts, type Image, createCanvas, loadImage } from "@napi-rs/canvas";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoPoints, pointImages } from "@sportsdataverse/sdvplot/chartjs";
import { Chart, registerables } from "chart.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Chart.js: logos as points, the 2024 AFC West's points for and against (a PNG in Node)",
  tags: ["node", "network", "chartjs", "logoPoints", "pointImages", "loadImage", "png", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const west = STANDINGS.filter((s) => s.division === "West");

// In Node the image helpers load marks through `loadImage`: fetch each URL and decode it on @napi-rs/canvas (whose
// own loadImage(url) also fetches by itself). Keep the promises: once they settle, pointImages has redrawn.
const loads: Promise<Image>[] = [];
const load = (url: string): Promise<Image> => {
  const p = fetch(url)
    .then((r) => r.arrayBuffer())
    .then((b) => loadImage(Buffer.from(b)));
  loads.push(p);
  return p;
};

Chart.register(...registerables);
// A build server may have no system fonts (Vercel's has none): register a bundled one before drawing, or every
// label is blank. Source Sans 3, SIL Open Font License (examples/fonts/OFL.txt).
const font = join(dirname(fileURLToPath(import.meta.url)), "../../../fonts/SourceSans3-Regular.ttf");
if (!GlobalFonts.registerFromPath(font, "Source Sans 3")) throw new Error(`no font at ${font}`);
Chart.defaults.font.family = "Source Sans 3";
const canvas = createCanvas(640, 400);
const chart = new Chart(canvas.getContext("2d") as unknown as CanvasRenderingContext2D, {
  type: "scatter",
  data: {
    datasets: [
      {
        data: west.map((s) => ({ x: s.pf, y: s.pa })),
        // one logo per point, in data order; each slot draws nothing until its image lands
        ...logoPoints(
          west.map((s) => s.team),
          { league: "nfl", radius: 20, loadImage: load },
        ),
      },
    ],
  },
  options: {
    responsive: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { min: 280, max: 440, title: { display: true, text: "Points for" } },
      // fewer points against is better: reversed, so the best teams sit top right
      y: { min: 280, max: 440, reverse: true, title: { display: true, text: "Points against" } },
    },
  },
  // pointImages updates the chart as each point's image lands
  plugins: [pointImages],
});
await Promise.all(loads);

const png = canvas.toBuffer("image/png").toString("base64");
chart.destroy();
export default `<img src="data:image/png;base64,${png}" width="640" height="400" alt="The 2024 AFC West as team logos, points for against points against: Kansas City, the Chargers, Denver and Las Vegas">`;
