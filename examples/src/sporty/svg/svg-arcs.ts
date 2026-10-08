import { SPORTS, leagues, surface } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: 'arcs: "svg": the same drawing, a fraction of the bytes',
  tags: ["toSVG", "svg", "arcs"],
} satisfies ExampleMeta;

// By default every arc is written point by point (200 per arc). `arcs: "svg"` finds the points that lie on
// one circle and writes them as a single SVG arc command; the drawing is the same. Football, tennis and
// volleyball surfaces have no arcs, so they do not change.
const kb = (s: string): number => Math.round(new TextEncoder().encode(s).length / 102.4) / 10;

export default SPORTS.map((sport) => {
  const league = leagues(sport).find((l) => l !== "custom") ?? "";
  const scene = surface(sport, league);
  const sampled = kb(toSVG(scene));
  const arcs = kb(toSVG(scene, { arcs: "svg" }));
  return `${`${sport} ${league}`.padEnd(22)} ${String(sampled).padStart(6)} KB -> ${String(arcs).padStart(5)} KB`;
});
