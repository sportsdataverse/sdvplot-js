import * as Plot from "@observablehq/plot";
import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Offence vs defence, 2024: EPA per play with a hover tip and a link per logo",
  tags: ["plot", "logos", "tip", "href", "linearRegressionY", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");

// nflverse 2024 regular season, rush or pass plays: EPA per play the offence gained and the defence allowed
const teams = NFL_TEAM_EPA_2024.map((t) => ({
  team: t.team,
  offense: t.off_epa / t.off_plays,
  defense: t.def_epa / t.def_plays,
}));
export default Plot.plot({
  width: 640,
  grid: true,
  x: { label: "Offensive EPA/play →" },
  y: { label: "↑ Defensive EPA/play allowed", reverse: true },
  marks: [
    Plot.linearRegressionY(teams, { x: "offense", y: "defense", stroke: "currentColor", strokeOpacity: 0.4 }),
    logos(teams, {
      league: "nfl",
      x: "offense",
      y: "defense",
      team: "team",
      height: 0.07,
      tip: { format: { x: ".3f", y: ".3f" } },
      href: (d: { team: string }) => `https://www.espn.com/nfl/team/_/name/${d.team.toLowerCase()}`,
      target: "_blank",
    }),
  ],
});
