import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts, type Image, createCanvas, loadImage } from "@napi-rs/canvas";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { type PointOptions, pointImages, wordmarkPoints } from "@sportsdataverse/sdvplot/chartjs";
import { Chart, type ChartConfiguration, registerables } from "chart.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Chart.js: wordmarks as points, the 2024 AFC West's wins and point differential (a PNG in Node)",
  tags: ["node", "network", "chartjs", "wordmarkPoints", "pointImages", "loadImage", "png", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const west = STANDINGS.filter((s) => s.division === "West");

// One config for the browser and for Node, built fresh per chart (Chart.js keeps state on what it is given). A
// browser loads each wordmark itself; Node passes `loadImage` (below).
const config = (o: Pick<PointOptions, "loadImage"> = {}): ChartConfiguration<"scatter"> => ({
  type: "scatter",
  data: {
    datasets: [
      {
        data: west.map((s) => ({ x: s.wins, y: s.pf - s.pa })),
        // a wordmark is about 3.6 times as wide as it is tall: radius sets the height (2 × radius px)
        ...wordmarkPoints(
          west.map((s) => s.team),
          { league: "nfl", radius: 12, ...o },
        ),
      },
    ],
  },
  options: {
    responsive: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { min: 2, max: 18, title: { display: true, text: "Wins" } },
      y: { min: -150, max: 150, title: { display: true, text: "Points for minus points against" } },
    },
  },
  plugins: [pointImages],
});
// In the browser: new Chart(canvas, config()) on a 640 x 360 canvas, as this page does.
export const browser = {
  lib: "chartjs",
  config,
  width: 640,
  height: 360,
  label:
    "The 2024 AFC West as team wordmarks, wins against point differential: Kansas City 15 and +59, the Chargers 11 and +101, Denver 10 and +114, Las Vegas 4 and -125",
} as const;

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
const canvas = createCanvas(browser.width, browser.height);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const chart = new Chart(ctx, config({ loadImage: load }));
await Promise.all(loads);

const png = canvas.toBuffer("image/png").toString("base64");
chart.destroy();
export default `<img src="data:image/png;base64,${png}" width="640" height="360" alt="${browser.label}">`;
