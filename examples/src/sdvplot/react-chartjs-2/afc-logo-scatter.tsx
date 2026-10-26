import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts, type Image, createCanvas, loadImage } from "@napi-rs/canvas";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { type PointOptions, logoPoints, pointImages } from "@sportsdataverse/sdvplot/chartjs";
import { Chart as ChartJS, registerables } from "chart.js";
import { type ReactElement, useState } from "react";
import { Chart, type ChartProps } from "react-chartjs-2";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "react-chartjs-2: logos as points, the 2024 AFC West's or East's points for and against (one chart, updated in place)",
  tags: ["node", "network", "react", "react-chartjs-2", "chartjs", "logoPoints", "pointImages", "png", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// react-chartjs-2 draws with what Chart.js has registered: register its controllers, elements and scales once. This is
// global; sdvplot's plugins are not registered, they go to each chart through the `plugins` prop.
ChartJS.register(...registerables);

// Each division's teams, picked by id from the 2024 standings
const DIVISIONS = { West: ["KC", "LAC", "DEN", "LV"], East: ["BUF", "MIA", "NYJ", "NE"] } as const;
type Division = keyof typeof DIVISIONS;
const rowsOf = (division: Division) =>
  DIVISIONS[division].map((team) => {
    const row = STANDINGS.find((s) => s.team === team);
    if (row === undefined) throw new Error(`no 2024 standings row for ${team}`);
    return row;
  });

// <Chart>'s props are a Chart.js config: react-chartjs-2 hands them to new Chart(canvas, ...), as Node does below. A
// browser loads each logo itself; Node passes `loadImage`.
const config = (division: Division, o: Pick<PointOptions, "loadImage"> = {}): ChartProps<"scatter"> => {
  const rows = rowsOf(division);
  return {
    type: "scatter",
    data: {
      datasets: [
        {
          // react-chartjs-2 updates a dataset in place by its label: a new division swaps the points and their logos
          label: "AFC",
          data: rows.map((s) => ({ x: s.pf, y: s.pa })),
          ...logoPoints(
            rows.map((s) => s.team),
            { league: "nfl", radius: 20, ...o },
          ),
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { min: 280, max: 540, title: { display: true, text: "Points for" } },
        // fewer points against is better: reversed, so the best teams sit top right
        y: { min: 280, max: 440, reverse: true, title: { display: true, text: "Points against" } },
      },
    },
    // read once, when react-chartjs-2 creates the chart: pointImages redraws it as each logo lands, on every update too
    plugins: [pointImages],
  };
};

function AfcScatter(): ReactElement {
  const [division, setDivision] = useState<Division>("West");
  return (
    <>
      <fieldset>
        <legend>AFC division</legend>
        {(Object.keys(DIVISIONS) as Division[]).map((d) => (
          <button key={d} type="button" aria-pressed={d === division} onClick={() => setDivision(d)}>
            AFC {d}
          </button>
        ))}
      </fieldset>
      <Chart {...config(division)} width={640} height={400} />
    </>
  );
}
// In the browser: <AfcScatter />; each button re-renders the same <Chart> with the other division's rows.
export const browser = {
  lib: "react-chartjs-2",
  chart: () => <AfcScatter />,
  width: 640,
  height: 400,
  label:
    "Team logos at 2024 points for against points against, the AFC West (Kansas City, the Chargers, Denver, Las Vegas) or, at a button, the AFC East (Buffalo, Miami, the Jets, New England)",
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
const chart = new ChartJS(ctx, config("West", { loadImage: load }));
await Promise.all(loads);

const png = canvas.toBuffer("image/png").toString("base64");
chart.destroy();
export default `<img src="data:image/png;base64,${png}" width="640" height="400" alt="${browser.label}">`;
