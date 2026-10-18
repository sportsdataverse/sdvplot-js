import * as Plot from "@observablehq/plot";
import { surface } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Curling sheets: a whole WCF sheet and a Curling Canada house, drawn vertically",
  tags: ["plot", "surface", "displayRange", "curling", "wcf", "curling_canada"],
} satisfies ExampleMeta;

// sporty draws curling sheets vertically, in feet: +y toward the top house. The "house" display range crops to the
// top house; the button's centre can be read off the scene's "button" feature.
const full = surface("wcf");
const house = surface("curling_canada", { displayRange: "house" });
const button = house.scene.features.find((f) => f.name === "button");
const ys = button?.kind === "polygon" ? button.points.map((p) => p[1]) : [0];
const tee = (Math.min(...ys) + Math.max(...ys)) / 2;

const div = document.createElement("div");
div.style.cssText = "display:flex;flex-wrap:wrap;gap:16px;align-items:end";
div.append(
  Plot.plot({ ...full.scales, height: 560, caption: "wcf: full", marks: full.marks }),
  Plot.plot({
    ...house.scales,
    width: 360,
    caption: `curling_canada: house (button centre at y = ${tee.toFixed(1)} ft)`,
    marks: [...house.marks, Plot.ruleY([tee], { stroke: "#333333", strokeDasharray: "4 3" })],
  }),
);
export default div;
