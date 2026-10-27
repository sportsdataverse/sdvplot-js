import { KC_PHI_GAMES_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoIcons, teamColorScale } from "@sportsdataverse/sdvplot/unovis";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Unovis on a dark card: the Chiefs' 2024 regular season as a network of logos, a link from each game's winner to its loser in the winner's colour",
  tags: ["unovis", "graph", "logoIcons", "teamColorScale", "dark mode", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Kansas City's 17 games, each a link from the winner to the loser, as wide as the margin
const links = KC_PHI_GAMES_2024.filter((g) => g.home_team === "KC" || g.away_team === "KC").map((g) => {
  const homeWon = g.home_score > g.away_score;
  return {
    source: homeWon ? g.home_team : g.away_team,
    target: homeWon ? g.away_team : g.home_team,
    team: homeWon ? g.home_team : g.away_team,
    margin: Math.abs(g.home_score - g.away_score),
    week: g.week,
  };
});
const teams = [...new Set(links.flatMap((l) => [l.source, l.target]))];
const nodes = teams.map((team) => ({ id: team, team }));
// the card's background: every team colour keeps 3:1 contrast on it and the teams stay distinct, and the logos are
// their dark variants
const BG = "#111827";
const color = teamColorScale("nfl", teams, { background: BG });
const logos = logoIcons("nfl", teams, { variant: "dark" });

// In the browser: new SingleContainer(el, { component: new Graph(config()), svgDefs: logos.svgDefs, height: 480 },
// data())
export const browser = {
  lib: "unovis",
  component: "Graph",
  config: () => ({
    layoutType: "force",
    nodeSize: 46,
    nodeIcon: (n: (typeof nodes)[number]) => logos(n.team),
    nodeIconSize: 34,
    nodeFill: "#1f2937",
    nodeStroke: (n: (typeof nodes)[number]) => color(n.team),
    nodeStrokeWidth: 4,
    nodeLabel: (n: (typeof nodes)[number]) => n.team,
    linkStroke: (l: (typeof links)[number]) => color(l.team),
    linkWidth: (l: (typeof links)[number]) => 1 + l.margin / 3,
    linkArrow: "single",
  }),
  data: () => ({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) }),
  svgDefs: logos.svgDefs,
  // Unovis's label colours for a dark card, in the docs' light and dark modes alike
  style: {
    background: BG,
    "--vis-graph-node-label-text-color": "#e5e7eb",
    "--vis-dark-graph-node-label-text-color": "#e5e7eb",
    "--vis-graph-node-label-background": BG,
    "--vis-dark-graph-node-label-background": BG,
  },
  width: 680,
  height: 480,
  label: `The Chiefs' 2024 regular season on a dark background: each team's logo, and a link from each game's winner to its loser in the winner's colour, as wide as the margin: ${links
    .map((l) => `week ${l.week} ${l.source} beat ${l.target} by ${l.margin}`)
    .join("; ")}`,
} as const;

// Unovis draws only in a browser; without JavaScript the page shows each game and the colour of its link
export default links.map((l) => ({ week: l.week, winner: l.source, loser: l.target, color: color(l.team) }));
