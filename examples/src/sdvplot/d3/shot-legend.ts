import { BKN_SHOTS_2026, NBA_LEAGUE_2026 } from "@sportsdataverse/examples/data";
import { appendLegend } from "@sportsdataverse/sdvplot/d3";
import { LEAGUE_PRIOR_ATTEMPTS, cellsVsLeague, diffScale, sizeCells } from "@sportsdataverse/sdvplot/shots";
import { create } from "d3";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "d3: the shot-chart legend, with the 1.5 ft hexagons' size key",
  tags: ["d3", "shots", "appendLegend", "sizeCells", "nba"],
} satisfies ExampleMeta;

// The key of blazing-the-nets main's hex chart: the colour bar of diffScale(), then a size key whose steps are 1,
// half the cap and the cap, for Brooklyn's 2025-26 shots in 1.5 ft hexagons. Sizes are in tenths of a foot, drawn
// here at one pixel per tenth.
const cells = cellsVsLeague(BKN_SHOTS_2026, NBA_LEAGUE_2026.hex15);
const sizes = sizeCells(cells, NBA_LEAGUE_2026.hex15);
const svg = create("svg").attr("viewBox", "0 0 300 200").attr("width", 300);
const height = appendLegend(svg.append("g"), diffScale(), {
  width: 280,
  notes: [`FG% is shrunk toward the league's by ${LEAGUE_PRIOR_ATTEMPTS} attempts.`],
  size: { px: sizes.size, steps: sizes.steps },
});
svg.attr("viewBox", `0 0 300 ${height}`);
export default svg.node();
