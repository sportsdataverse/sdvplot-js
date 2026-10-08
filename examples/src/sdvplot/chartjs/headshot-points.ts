import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts, type Image, createCanvas, loadImage } from "@napi-rs/canvas";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { headshotPoints, pointImages } from "@sportsdataverse/sdvplot/chartjs";
import { Chart, registerables } from "chart.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Chart.js: quarterback headshots as points, the 2024 AFC West (a PNG in Node)",
  tags: ["node", "network", "chartjs", "headshotPoints", "pointImages", "loadImage", "png", "nfl"],
} satisfies ExampleMeta;

// ESPN player ids need no league data: headshotPoints builds each URL from the id alone.
const west = STANDINGS.filter((s) => s.division === "West");

// ESPN's image combiner resizes on request, so the loader asks for twice the drawn size rather than the 1096 px
// original; it fetches each URL and decodes it on @napi-rs/canvas. Keep the promises: once they settle,
// pointImages has redrawn.
const loads: Promise<Image>[] = [];
const load = (url: string): Promise<Image> => {
  const p = fetch(`${url}&w=96&h=70`)
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
const canvas = createCanvas(640, 360);
const chart = new Chart(canvas.getContext("2d") as unknown as CanvasRenderingContext2D, {
  type: "scatter",
  data: {
    datasets: [
      {
        data: west.map((s) => ({ x: s.pf, y: s.wins })),
        // each team's most frequent starter, 2 × radius px tall (an ESPN headshot is 600:436, so a little wider)
        ...headshotPoints(
          west.map((s) => s.qb_espn_id),
          { league: "nfl", radius: 24, loadImage: load },
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
      y: { min: 0, max: 18, title: { display: true, text: "Wins" } },
    },
  },
  plugins: [pointImages],
});
await Promise.all(loads);

const png = canvas.toBuffer("image/png").toString("base64");
chart.destroy();
export default `<img src="data:image/png;base64,${png}" width="640" height="360" alt="Headshots of the 2024 AFC West's most frequent starting quarterbacks, Patrick Mahomes, Justin Herbert, Bo Nix and Gardner Minshew, at their teams' points for and wins">`;
