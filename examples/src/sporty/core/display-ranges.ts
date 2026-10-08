import * as Plot from "@observablehq/plot";
import { displayRanges, surface } from "@sportsdataverse/sporty";
import { surfaceMark, surfaceScales } from "@sportsdataverse/sporty/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Every hockey display range on one rink",
  tags: ["plot", "displayRange", "displayRanges", "hockey", "nhl"],
} satisfies ExampleMeta;

// A display range only changes the scene's bbox (the part of the rink a figure shows). Several names are
// aliases ("offense", "offence"), so group them by the box they produce and outline each box once.
const boxes = new Map<string, { bbox: readonly number[]; names: string[] }>();
for (const name of displayRanges("hockey")) {
  const { bbox } = surface("hockey", "nhl", { displayRange: name });
  const key = bbox.join();
  const box = boxes.get(key) ?? { bbox, names: [] };
  box.names.push(name);
  boxes.set(key, box);
}
const rows = [...boxes.values()].map(({ bbox: [x1 = 0, y1 = 0, x2 = 0, y2 = 0], names }, i) => ({
  x1: x1 + i,
  y1: y1 + i,
  x2: x2 - i,
  y2: y2 - i,
  label: names.filter((n) => !n.includes(" ")).join(" / "),
}));

const rink = surface("hockey", "nhl", { arcResolution: 32 }); // 32 points per arc is plenty at 900 px
export default Plot.plot({
  ...surfaceScales(rink),
  width: 900,
  color: { type: "categorical", legend: true },
  marks: [
    ...surfaceMark(rink),
    Plot.rect(rows, {
      x1: "x1",
      y1: "y1",
      x2: "x2",
      y2: "y2",
      stroke: "label",
      strokeWidth: 2,
      fill: "none",
    }),
  ],
});
