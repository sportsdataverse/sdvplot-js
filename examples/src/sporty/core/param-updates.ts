import { type BasketballParamUpdates, surface } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Changing a dimension: the pre-1964 lane",
  tags: ["surface", "updates", "BasketballParamUpdates", "basketball", "nba"],
} satisfies ExampleMeta;

// `updates` overrides any parameter of the league's spec; the type lists every one (and rejects typos).
// The NBA lane is 16 ft wide (with a 12 ft inner box); the 1951-1964 lane was 12 ft.
const narrow: BasketballParamUpdates = { lane_width: [12, 12] };

const draw = (label: string, updates?: BasketballParamUpdates): string =>
  `<figure style="margin:0">${toSVG(surface("basketball", "nba", { displayRange: "offense", ...(updates ? { updates } : {}) }), { width: 300, arcs: "svg" })}<figcaption>${label}</figcaption></figure>`;

export default `<div style="display:flex;flex-wrap:wrap;gap:16px">${draw("nba (16 ft lane)")}${draw("updates: { lane_width: [12, 12] }", narrow)}</div>`;
