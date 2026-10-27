import { SUPER_BOWL_LIX_DRIVES } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColorScale } from "@sportsdataverse/sdvplot/unovis";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Unovis: Super Bowl LIX's 26 drives as a Sankey, from where each started to how it ended, each team's flows in its colour",
  tags: ["unovis", "sankey", "teamColorScale", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// where a drive started, in yards from the opponent's end zone
const band = (yardline: number) =>
  yardline >= 80
    ? "Own 1-20"
    : yardline >= 60
      ? "Own 21-40"
      : yardline >= 41
        ? "Own 41 to opp. 41"
        : "Opp. 40 and in";
// three columns: the team with the ball, where its drive started, how the drive ended (ESPN's words)
const counts = new Map<string, { source: string; target: string; team: string; value: number }>();
const add = (source: string, target: string, team: string) => {
  const key = `${source}>${target}>${team}`;
  const link = counts.get(key) ?? { source, target, team, value: 0 };
  link.value += 1;
  counts.set(key, link);
};
for (const d of SUPER_BOWL_LIX_DRIVES) {
  add(`team:${d.team}`, `band:${band(d.yardline_100)}`, d.team);
  add(`band:${band(d.yardline_100)}`, `result:${d.result}`, d.team);
}
const links = [...counts.values()];
const ids = [...new Set(links.flatMap((l) => [l.source, l.target]))];
const nodes = ids.map((id) => ({
  id,
  label: id.slice(id.indexOf(":") + 1),
  team: id.startsWith("team:") ? id.slice(5) : undefined,
}));
// every flow in the colour of the team that had the ball; the band and result nodes stay grey
const color = teamColorScale("nfl", ["KC", "PHI"]);

// In the browser: new SingleContainer(el, { component: new Sankey(config()), height: 420 }, data())
export const browser = {
  lib: "unovis",
  component: "Sankey",
  config: () => ({
    label: (n: (typeof nodes)[number]) => n.label,
    nodeColor: (n: (typeof nodes)[number]) => (n.team === undefined ? "#9ca3af" : color(n.team)),
    linkColor: (l: (typeof links)[number]) => color(l.team),
    nodeWidth: 14,
  }),
  data: () => ({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) }),
  width: 680,
  height: 420,
  label: `Super Bowl LIX's 26 drives, Kansas City's in red and Philadelphia's in green, flowing from the team to where the drive started and on to how it ended: ${links
    .filter((l) => l.source.startsWith("band:"))
    .map((l) => `${l.team} ${l.source.slice(5)} to ${l.target.slice(7)}, ${l.value}`)
    .join("; ")}`,
} as const;

// Unovis draws only in a browser; without JavaScript the page shows each flow, its drives and its colour
export default links.map((l) => ({ from: l.source, to: l.target, drives: l.value, color: color(l.team) }));
