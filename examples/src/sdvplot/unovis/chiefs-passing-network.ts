import { SUPER_BOWL_LIX_KC_PASSER, SUPER_BOWL_LIX_KC_TARGETS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { headshotIcons, teamColorScale } from "@sportsdataverse/sdvplot/unovis";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Unovis in React: Patrick Mahomes' Super Bowl LIX targets as a passing network, headshots in the nodes, links as wide as the targets, in Chiefs red",
  tags: ["react", "unovis", "unovis-react", "graph", "headshotIcons", "teamColorScale", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// the quarterback and the nine Chiefs he threw to, by ESPN athlete id (a string, as ESPN serves it)
const nodes = [
  {
    id: SUPER_BOWL_LIX_KC_PASSER,
    name: "Patrick Mahomes",
    team: "KC",
    targets: SUPER_BOWL_LIX_KC_TARGETS.reduce((n, r) => n + r.targets, 0),
  },
  ...SUPER_BOWL_LIX_KC_TARGETS.map((r) => ({ id: r.player, name: r.name, team: "KC", targets: r.targets })),
];
const links = SUPER_BOWL_LIX_KC_TARGETS.map((r) => ({
  source: SUPER_BOWL_LIX_KC_PASSER,
  target: r.player,
  team: "KC",
  targets: r.targets,
}));
const heads = headshotIcons(
  "nfl",
  nodes.map((n) => n.id),
);
const color = teamColorScale("nfl", ["KC"]);

// In React: <VisSingleContainer data={data()} svgDefs={heads.svgDefs} height={460}><VisGraph {...config()} />
// </VisSingleContainer>, from @unovis/react
export const browser = {
  lib: "unovis-react",
  component: "Graph",
  config: () => ({
    layoutType: "force",
    nodeSize: (n: (typeof nodes)[number]) => (n.id === SUPER_BOWL_LIX_KC_PASSER ? 64 : 44),
    nodeIcon: (n: (typeof nodes)[number]) => heads(n.id),
    nodeIconSize: (n: (typeof nodes)[number]) => (n.id === SUPER_BOWL_LIX_KC_PASSER ? 56 : 38),
    nodeFill: "#ffffff",
    nodeStroke: (n: (typeof nodes)[number]) => color(n.team),
    nodeStrokeWidth: 4,
    nodeLabel: (n: (typeof nodes)[number]) => n.name,
    nodeSubLabel: (n: (typeof nodes)[number]) =>
      n.id === SUPER_BOWL_LIX_KC_PASSER ? `${n.targets} passes` : `${n.targets} targets`,
    linkStroke: (l: (typeof links)[number]) => color(l.team),
    linkWidth: (l: (typeof links)[number]) => 1.5 * l.targets,
  }),
  data: () => ({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) }),
  svgDefs: heads.svgDefs,
  width: 680,
  height: 460,
  label: `Patrick Mahomes' 32 targets in Super Bowl LIX as a network: a link from him to each Chief he threw to, as wide as the targets, each node the player's headshot: ${SUPER_BOWL_LIX_KC_TARGETS.map((r) => `${r.name} ${r.targets}`).join(", ")}`,
} as const;

// Unovis draws only in a browser; without JavaScript the page shows each target count and the headshot it draws
export default links.map((l) => ({
  receiver: nodes.find((n) => n.id === l.target)?.name,
  targets: l.targets,
  headshot: heads(l.target),
}));
