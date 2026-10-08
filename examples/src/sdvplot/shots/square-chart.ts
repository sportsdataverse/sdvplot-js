import * as Plot from "@observablehq/plot";
import { BKN_SHOTS_2026, NBA_LEAGUE_2026, NBA_LEAGUE_SQUARE_2026 } from "@sportsdataverse/examples/data";
import { shotCells, surface } from "@sportsdataverse/sdvplot/plot";
import { type LeagueIndex, cellsVsLeague, sizeCells } from "@sportsdataverse/sdvplot/shots";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Hexagons or squares: the same shots against the league in cells of equal area",
  tags: ["plot", "shots", "shotCells", "cellsVsLeague", "sizeCells", "squares", "nba"],
} satisfies ExampleMeta;

// Brooklyn's first 2000 shots of 2025-26 against the 2025-26 league twice: in 1 ft hexagons (radius 10), and in
// squares of the same area (side 16.1 tenths of a foot). Each league index bins the league on its own lattice and
// the player is binned on the index's lattice, so only the cell outline differs.
const court = surface("nba", { displayRange: "defense", rotation: 90 });
const panel = (name: string, index: LeagueIndex, shape: "hex" | "square"): SVGSVGElement | HTMLElement => {
  const cells = cellsVsLeague(BKN_SHOTS_2026, index);
  return Plot.plot({
    ...court.scales,
    width: 420,
    caption: `${name}: ${cells.length} cells`,
    marks: [
      ...court.marks,
      shotCells(cells, { r: sizeCells(cells, index).r, shape, frame: "nba-legacy-vertical" }),
    ],
  });
};

const charts = document.createElement("div");
charts.style.cssText = "display: flex; flex-wrap: wrap; gap: 16px";
charts.append(
  panel("Hexagons, radius 10", NBA_LEAGUE_2026.hex10, "hex"),
  panel("Squares of the same area", NBA_LEAGUE_SQUARE_2026, "square"),
);
export default charts;
