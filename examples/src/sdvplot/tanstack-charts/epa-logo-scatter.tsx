import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoDots, withPatterns } from "@sportsdataverse/sdvplot/tanstack";
import { defineChart, dot } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { renderChartSvg } from "@tanstack/charts/svg";
import { tooltip } from "@tanstack/charts/tooltip";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "TanStack Charts: every NFL team's 2024 offence and defence EPA per play, each point its team's logo",
  tags: ["react", "tanstack-charts", "scatter", "logoDots", "withPatterns", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// EPA per play from the season totals (nflverse play by play, rushes and passes); every team, so nothing to pick
if (NFL_TEAM_EPA_2024.length !== 32) throw new Error(`${NFL_TEAM_EPA_2024.length} teams, not 32`);
const rows = NFL_TEAM_EPA_2024.map((t) => ({
  team: t.team,
  offense: t.off_epa / t.off_plays,
  defense: t.def_epa / t.def_plays,
}));
// one dot mark per team, each filled with its logo, 26 px tall and centred on its (offense, defense)
const logos = logoDots(rows, { x: "offense", y: "defense", team: "team", league: "nfl", size: 26 });
const perPlay = (v: unknown) => Number(v).toFixed(2);

export default (
  <Chart
    definition={defineChart(
      {
        marks: logos.map((d) => dot(d.data, d.options)),
        scales: {
          x: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: { label: "offence: EPA per play", ticks: { format: perPlay } },
          },
          // a defence wants negative EPA: the best defences sit at the top
          y: {
            scale: scaleLinear,
            nice: true,
            reverse: true,
            grid: true,
            axis: { label: "defence: EPA per play allowed", ticks: { format: perPlay } },
          },
        },
      },
      // the built-in tooltip: hover or focus a logo for its two values
      { tooltip },
    )}
    // the logos' patterns, written into the chart's own svg
    renderSvg={withPatterns(renderChartSvg, logos)}
    idPrefix="epa-logos"
    width={640}
    height={480}
    ariaLabel={`The ${rows.length} NFL teams of 2024 by offensive EPA per play and defensive EPA per play allowed (the best defences at the top), each drawn as its logo`}
    style={{ background: "#ffffff", color: "#1c1e21" }}
  />
);
