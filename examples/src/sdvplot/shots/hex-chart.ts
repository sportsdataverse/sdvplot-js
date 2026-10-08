import * as Plot from "@observablehq/plot";
import { BKN_SHOTS_2026, NBA_LEAGUE_2026 } from "@sportsdataverse/examples/data";
import { shotCells, surface } from "@sportsdataverse/sdvplot/plot";
import { cellsVsDistance, cellsVsLeague, diffScale, sizeCells } from "@sportsdataverse/sdvplot/shots";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Hex shot chart against the league: blazing-the-nets main and master",
  tags: ["plot", "shots", "shotCells", "cellsVsLeague", "cellsVsDistance", "sizeCells", "diffScale", "nba"],
} satisfies ExampleMeta;

// Brooklyn's first 2000 shots of 2025-26 against the 2025-26 league, hoop at the bottom. Colour is a cell's FG% minus
// the league's; size is its attempts.
const court = surface("nba", { displayRange: "defense", rotation: 90 });
const frame = "nba-legacy-vertical";

// main: 1.5 ft hexagons against the league in the same hexagon, shrunk toward it by 25 attempts, sized by "sqrt-p95"
const main = cellsVsLeague(BKN_SHOTS_2026, NBA_LEAGUE_2026.hex15);
const mainSizes = sizeCells(main, NBA_LEAGUE_2026.hex15);
// master: 1 ft hexagons against the league at the hexagon's distance, the raw difference, sized by "linear-cap"
const master = cellsVsDistance(BKN_SHOTS_2026, NBA_LEAGUE_2026.byFoot, 10);
const masterSizes = sizeCells(master, { radius: 10, rule: "linear-cap" });
const masterScale = diffScale({ palette: "master" });

// diffScale's domain is a fraction (0.15 is 15 points): label the ticks in points, as d3's appendLegend does
const pts = (d: number): string => (d === 0 ? "0" : `${d > 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1)}`);

const panel = (caption: string, cells: Plot.Markish, scale: ReturnType<typeof diffScale>): HTMLDivElement => {
  const div = document.createElement("div");
  div.append(
    Plot.plot({ ...court.scales, width: 420, caption, marks: [...court.marks, cells] }),
    Plot.legend({ color: { ...scale.plot, label: "FG% vs league (points)", tickFormat: pts } }),
  );
  return div;
};

const charts = document.createElement("div");
charts.style.cssText = "display: flex; flex-wrap: wrap; gap: 16px";
charts.append(
  panel(
    "main: 1.5 ft hexagons against the league in the same hexagon",
    shotCells(main, { r: mainSizes.r, frame, tip: true }),
    diffScale(),
  ),
  panel(
    "master: 1 ft hexagons against the league at the same distance",
    shotCells(master, { r: masterSizes.r, prior: 0, scale: masterScale, frame, tip: true }),
    masterScale,
  ),
);
export default charts;
