import { surface } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "toSVG options: size, background, precision, id",
  tags: ["toSVG", "svg", "ssr", "volleyball", "fivb"],
} satisfies ExampleMeta;

// toSVG needs no DOM: the same string comes out in Node, a worker or the browser.
const court = surface("volleyball", "fivb");
const svg = toSVG(court, {
  width: 520, // height follows the court's aspect unless given
  background: "#f4efe6", // painted behind every feature
  precision: 2, // decimals per coordinate (default 4); fewer is smaller
  id: "fivb-court", // an id on the <svg>, for CSS or a <use href="#fivb-court">
});

export default svg;
