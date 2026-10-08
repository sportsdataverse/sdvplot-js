import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { onColor, palette } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "A palette as swatches",
  tags: ["palette", "colors", "nfl"],
} satisfies ExampleMeta;

// { team: "#hex" } keyed by your own values; Plot draws CSS colour strings as they are.
const colors = await palette(
  "nfl",
  STANDINGS.map((s) => s.team),
);
const swatches = Object.entries(colors).map(([team, hex]) => ({ team, hex, ink: onColor(hex) }));

export default Plot.plot({
  height: 90,
  x: { axis: null },
  y: { axis: null },
  marks: [
    Plot.cell(swatches, { x: "team", fill: "hex", inset: 2 }),
    Plot.text(swatches, { x: "team", text: (d) => `${d.team}\n${d.hex}`, fill: "ink" }),
  ],
});
