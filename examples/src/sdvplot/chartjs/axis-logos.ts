import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts, type Image, createCanvas, loadImage } from "@napi-rs/canvas";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { axisLogos, teamColor } from "@sportsdataverse/sdvplot/chartjs";
import { Chart, registerables } from "chart.js";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Chart.js: team logos for an axis's tick labels, 2024 AFC West wins (a PNG in Node)",
  tags: ["node", "network", "chartjs", "axisLogos", "teamColor", "loadImage", "png", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const west = STANDINGS.filter((s) => s.division === "West");
const teams = west.map((s) => s.team);

// In Node the image helpers load marks through `loadImage`: fetch each URL and decode it on @napi-rs/canvas (whose
// own loadImage(url) also fetches by itself). Keep the promises: once they settle, axisLogos has redrawn.
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
const canvas = createCanvas(640, 320);
const chart = new Chart(canvas.getContext("2d") as unknown as CanvasRenderingContext2D, {
  type: "bar",
  data: {
    labels: teams,
    datasets: [{ data: west.map((s) => s.wins), backgroundColor: teamColor(teams, "nfl") }],
  },
  options: {
    responsive: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: { y: { min: 0, max: 16, ticks: { stepSize: 4 }, title: { display: true, text: "Wins" } } },
  },
  // the x axis is a category scale: each label that names a team is painted as its logo, its text blanked
  plugins: [axisLogos("x", { league: "nfl", size: 36, loadImage: load })],
});
// after new Chart(...): axisLogos asks for its images while the chart is first laid out
await Promise.all(loads);

const png = canvas.toBuffer("image/png").toString("base64");
chart.destroy();
export default `<img src="data:image/png;base64,${png}" width="640" height="320" alt="2024 AFC West wins in team colours, each bar labelled by its team's logo: Kansas City 15, the Chargers 11, Denver 10, Las Vegas 4">`;
