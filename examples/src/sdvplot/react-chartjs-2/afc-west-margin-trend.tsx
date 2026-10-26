import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts, type Image, createCanvas, loadImage } from "@napi-rs/canvas";
import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { type PointOptions, logoPoints, pointImages, teamColor } from "@sportsdataverse/sdvplot/chartjs";
import { Chart as ChartJS, registerables } from "chart.js";
import { Chart, type ChartProps } from "react-chartjs-2";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "react-chartjs-2: the 2024 AFC West's running point differential week by week, team-coloured lines ending in logos",
  tags: ["node", "network", "react", "react-chartjs-2", "chartjs", "teamColor", "logoPoints", "png", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
ChartJS.register(...registerables); // once, globally: Chart.js's controllers, elements and scales

// Each team picked by id from the week-by-week margins (null is the bye week); the line is their running sum.
const teams = ["KC", "LAC", "DEN", "LV"];
const series = teams.map((team) => {
  const season = AFC_WEEKS_2024.find((s) => s.team === team);
  if (season === undefined) throw new Error(`no 2024 weeks for ${team}`);
  const points: { x: number; y: number }[] = [];
  for (const [i, m] of season.margins.entries())
    points.push({ x: i + 1, y: (points.at(-1)?.y ?? 0) + (m ?? 0) });
  return { team, points };
});

// <Chart>'s props are a Chart.js config: react-chartjs-2 hands them to new Chart(canvas, ...), as Node does below.
const config = (o: Pick<PointOptions, "loadImage"> = {}): ChartProps<"line"> => ({
  type: "line",
  data: {
    datasets: series.map(({ team, points }) => ({
      label: team,
      data: points,
      borderWidth: 3,
      borderColor: teamColor(team, "nfl"),
      backgroundColor: teamColor(team, "nfl", { alpha: 0.5 }),
      // one logo style, repeated per point, drawn only at the line's end
      pointStyle: logoPoints([team], { league: "nfl", radius: 14, ...o }).pointStyle,
      pointRadius: points.map((_, i) => (i === points.length - 1 ? 14 : 0)),
      clip: false, // the end logos may cross the chart area's edge; the layout padding leaves them room
    })),
  },
  options: {
    responsive: false,
    animation: false,
    layout: { padding: { top: 16, right: 18 } },
    plugins: { legend: { display: false } },
    scales: {
      x: { type: "linear", min: 1, max: 18, ticks: { stepSize: 1 }, title: { display: true, text: "Week" } },
      y: { title: { display: true, text: "Point differential, season to date" } },
    },
  },
  plugins: [pointImages],
});
// In the browser: <Chart {...config()} /> on a 640 x 400 canvas.
export const browser = {
  lib: "react-chartjs-2",
  chart: () => <Chart {...config()} width={640} height={400} />,
  width: 640,
  height: 400,
  label:
    "The 2024 AFC West's point differential summed week by week in team colours, each line ending in its team's logo: Denver +114, the Chargers +101, Kansas City +59, Las Vegas -125",
} as const;

// In Node the image helpers load marks through `loadImage`: fetch each URL and decode it on @napi-rs/canvas. Keep the
// promises: once they settle, pointImages has redrawn.
const loads: Promise<Image>[] = [];
const load = (url: string): Promise<Image> => {
  const p = fetch(url)
    .then((r) => r.arrayBuffer())
    .then((b) => loadImage(Buffer.from(b)));
  loads.push(p);
  return p;
};

// A build server may have no system fonts (Vercel's has none): register a bundled one before drawing, or every
// label is blank. Source Sans 3, SIL Open Font License (examples/fonts/OFL.txt).
const font = join(dirname(fileURLToPath(import.meta.url)), "../../../fonts/SourceSans3-Regular.ttf");
if (!GlobalFonts.registerFromPath(font, "Source Sans 3")) throw new Error(`no font at ${font}`);
ChartJS.defaults.font.family = "Source Sans 3";
const canvas = createCanvas(browser.width, browser.height);
const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
const chart = new ChartJS(ctx, config({ loadImage: load }));
await Promise.all(loads);

const png = canvas.toBuffer("image/png").toString("base64");
chart.destroy();
export default `<img src="data:image/png;base64,${png}" width="640" height="400" alt="${browser.label}">`;
