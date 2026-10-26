import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts, type Image, createCanvas, loadImage } from "@napi-rs/canvas";
import { AFC_WEEKS_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { type AxisLogoOptions, axisLogos, teamColorPalette } from "@sportsdataverse/sdvplot/chartjs";
import { Chart as ChartJS, type Plugin, registerables } from "chart.js";
import { Chart, type ChartProps } from "react-chartjs-2";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "react-chartjs-2: the AFC West's 2024 point differentials on a dark background, dark-mode team colours and logo ticks",
  tags: [
    "node",
    "network",
    "react",
    "react-chartjs-2",
    "chartjs",
    "axisLogos",
    "teamColorPalette",
    "dark mode",
    "png",
    "nfl",
  ],
} satisfies ExampleMeta;

await loadLeague("nfl");
ChartJS.register(...registerables); // once, globally: Chart.js's controllers, elements and scales

// Each team picked by id from the week-by-week margins (null is the bye); its season's point differential is their sum.
const teams = ["KC", "LAC", "DEN", "LV"];
const diffs = teams.map((team) => {
  const season = AFC_WEEKS_2024.find((s) => s.team === team);
  if (season === undefined) throw new Error(`no 2024 weeks for ${team}`);
  return season.margins.reduce((n: number, m) => n + (m ?? 0), 0);
});
const background = "#181a1b";
// every bar keeps 3:1 against the background and stays apart from the others: Denver's navy and the Raiders' black,
// as teamColor gives them, would sink into it (each takes its other colour, orange and silver)
const colors = teamColorPalette("nfl", teams, { background });
const ink = "#e3e3e3";
// Chart.js leaves the canvas transparent: paint the background first, so a saved PNG is dark too
const backdrop: Plugin<"bar"> = {
  id: "backdrop",
  beforeDraw: ({ ctx, width, height }) => {
    ctx.save();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
};

// <Chart>'s props are a Chart.js config: react-chartjs-2 hands them to new Chart(canvas, ...), as Node does below.
const config = (o: Pick<AxisLogoOptions, "loadImage"> = {}): ChartProps<"bar"> => ({
  type: "bar",
  data: { labels: teams, datasets: [{ label: "differential", data: diffs, backgroundColor: colors }] },
  options: {
    responsive: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: ink } },
      y: {
        grid: { color: "#3a3d3f" },
        ticks: { color: ink },
        title: { display: true, text: "Point differential", color: ink },
      },
    },
  },
  // the team axis' labels painted as each team's logo, 32 px tall, their text blanked (`variant: "dark"` would take a
  // team's logo for dark backgrounds where it has one)
  plugins: [backdrop, axisLogos("x", { league: "nfl", size: 32, ...o })],
});
// In the browser: <Chart {...config()} /> on a 640 x 360 canvas.
export const browser = {
  lib: "react-chartjs-2",
  chart: () => <Chart {...config()} width={640} height={360} />,
  width: 640,
  height: 360,
  label:
    "The 2024 AFC West's point differentials on a dark background in team colours, each bar labelled by its team's logo: Kansas City +59, the Chargers +101, Denver +114, Las Vegas -125",
} as const;

// In Node the image helpers load marks through `loadImage`: fetch each URL and decode it on @napi-rs/canvas. Keep the
// promises: once they settle, axisLogos has redrawn.
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
// after new Chart(...): axisLogos asks for its images while the chart is first laid out
await Promise.all(loads);

const png = canvas.toBuffer("image/png").toString("base64");
chart.destroy();
export default `<img src="data:image/png;base64,${png}" width="640" height="360" alt="${browser.label}">`;
