import { WC2018_FINAL_FRANCE_PASSES, WC2018_FINAL_FRANCE_RECIPIENTS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { passNetwork } from "@sportsdataverse/sdvplot/cytoscape";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Cytoscape.js: France's first-half passing network in the 2018 World Cup final, players where they passed and received, edges as wide as their passes",
  tags: ["cytoscape", "passNetwork", "teamStylesheet", "soccer", "pass-network", "statsbomb"],
} satisfies ExampleMeta;

await loadLeague("soccer");
// Each SPADL pass (where it started and ended, metres from the bottom-left corner of a 105 x 68 pitch, France attacking
// left to right) joined by action id to its StatsBomb event's passer and receiver. France is ESPN soccer team 478.
const receivers = new Map(WC2018_FINAL_FRANCE_RECIPIENTS.map((r) => [r.action_id, r]));
const passes = WC2018_FINAL_FRANCE_PASSES.map((p) => {
  const r = receivers.get(p.action_id);
  if (r === undefined) throw new Error(`no passer and receiver for action ${p.action_id}`);
  return { ...p, ...r, team: "478" };
});
// StatsBomb ids are not ESPN athlete ids, and soccer has no ESPN headshots, so every player is the fallback node: a
// circle in France's navy with the name's initials in white (headshots: false says so, so nothing warns). Each node
// sits at the mean of where the player passed from and received; edges point at the receiver, 10 px for the most
// frequent pair and the others in proportion. minWeight: 2 draws only the pairs that linked up at least twice (the
// usual pass-map threshold: the one-off pairs would bury the regular links).
const { elements, style } = passNetwork(passes, {
  from: "player_id",
  to: "recipient_id",
  fromName: "player_name",
  toName: "recipient_name",
  team: "team",
  league: "soccer",
  idSystem: "team_id",
  x: "start_x",
  y: "start_y",
  xend: "end_x",
  yend: "end_y",
  headshots: false,
  minWeight: 2,
});
if (elements.nodes.length !== 11)
  throw new Error(`expected France's 11 passers and receivers, got ${elements.nodes.length}`);
const top = elements.edges.reduce((a, b) => (b.data.weight > a.data.weight ? b : a));
const name = (id: string): string => elements.nodes.find((n) => n.data.id === id)?.data.label ?? id;
// In the browser: cytoscape({ container, elements, style, layout: { name: "preset" } })
export const browser = {
  lib: "cytoscape",
  elements: () => structuredClone(elements),
  style,
  width: 760,
  height: 500,
  label: `France's first-half passing network in the 2018 World Cup final: ${elements.nodes.length} players at their average positions, attacking left to right, and ${elements.edges.length} passer-to-receiver links used at least twice, the most frequent ${name(top.data.source)} to ${name(top.data.target)} (${top.data.weight} passes)`,
} as const;

// Cytoscape draws only in a browser; without JavaScript the page shows what the network holds.
export default {
  players: elements.nodes.length,
  links: elements.edges.length,
  passesOnTheseLinks: elements.edges.reduce((s, e) => s + e.data.weight, 0),
  mostFrequent: `${name(top.data.source)} to ${name(top.data.target)}, ${top.data.weight} passes`,
  node: elements.nodes[0],
  edge: top,
};
