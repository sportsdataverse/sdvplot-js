import { surface } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "arcResolution: points per arc, and what they cost",
  tags: ["arcResolution", "toSVG", "hockey", "nhl"],
} satisfies ExampleMeta;

// Every circle and corner is sampled as `arcResolution` points (default 200). Fewer points, smaller output;
// toSVG's `arcs: "svg"` writes detected circles as arc commands, so it shrinks the file at any resolution.
const kb = (s: string): string => `${(new TextEncoder().encode(s).length / 1024).toFixed(1)} KB`;
const cost = (arcResolution: number) => {
  const rink = surface("hockey", "nhl", { arcResolution });
  let points = 0;
  for (const f of rink.features) if (f.kind === "polygon") points += f.points.length;
  return { points, toSVG: kb(toSVG(rink)), 'toSVG arcs: "svg"': kb(toSVG(rink, { arcs: "svg" })) };
};

export default { "arcResolution: 12": cost(12), "arcResolution: 200 (default)": cost(200) };
