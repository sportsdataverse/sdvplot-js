import * as Plot from "@observablehq/plot";
import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague, resolveSync } from "@sportsdataverse/sdvplot";
import { logos } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Offence vs defence, 2024: EPA per play with a hover tip and a link per logo",
  tags: ["plot", "logos", "tip", "href", "linearRegressionY", "resolveSync", "nfl"],
} satisfies ExampleMeta;

const nfl = await loadLeague("nfl");

// nflverse 2024 regular season, rush or pass plays: EPA per play the offence gained and the defence allowed
const teams = NFL_TEAM_EPA_2024.map((t) => ({
  team: t.team,
  offense: t.off_epa / t.off_plays,
  defense: t.def_epa / t.def_plays,
}));
// ESPN's team pages go by ESPN's abbreviation, not always nflverse's (WAS is WSH, LA is LAR). sdvplot's aliases carry
// both: resolve the nflverse code to its team, then read that team's espn_abbr.
const espnAbbr = new Map(
  nfl.aliases.filter((a) => a.id_system === "espn_abbr").map((a) => [a.team_id, a.value]),
);
const espnPage = (team: string): string => {
  const id = resolveSync(team, "nfl", { idSystem: "nflverse", season: 2024 }) ?? "";
  return `https://www.espn.com/nfl/team/_/name/${espnAbbr.get(id)?.toLowerCase()}`;
};

export default Plot.plot({
  width: 640,
  grid: true,
  // the scales' labels are what the tip shows; the reversed y axis says which way is better
  x: { label: "Offensive EPA/play" },
  y: { label: "Defensive EPA/play allowed", reverse: true },
  marks: [
    Plot.axisY({ label: "↑ Better defence (defensive EPA/play allowed, reversed)" }),
    Plot.linearRegressionY(teams, { x: "offense", y: "defense", stroke: "currentColor", strokeOpacity: 0.4 }),
    logos(teams, {
      league: "nfl",
      x: "offense",
      y: "defense",
      team: "team",
      height: 0.07,
      tip: { format: { x: ".3f", y: ".3f" } },
      href: (d: { team: string }) => espnPage(d.team),
      target: "_blank",
    }),
  ],
});
