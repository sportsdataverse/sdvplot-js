import { FT_PER_UNIT, convertPoints, convertUnits, normalizeUnit, surface } from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Units: a court in metres, and the converters",
  tags: ["units", "convertUnits", "convertPoints", "normalizeUnit", "FT_PER_UNIT", "basketball", "nba"],
} satisfies ExampleMeta;

// `units` rebuilds the scene in another unit: every coordinate and the bbox are in metres here.
const court = surface("basketball", "nba", { units: "m" });

const facts = {
  "court.units": court.units,
  "court.bbox (m)": court.bbox.map((v) => v.toFixed(2)).join(", "),
  "convertUnits(94, 'ft', 'm')": convertUnits(94, "ft", "m").toFixed(3),
  "convertPoints([[47, 25]], 'ft', 'yd')": JSON.stringify(convertPoints([[47, 25]], "ft", "yd")),
  "normalizeUnit('Metres')": normalizeUnit("Metres"),
  "FT_PER_UNIT.m": FT_PER_UNIT.m.toFixed(4),
};

const list = Object.entries(facts)
  .map(([k, v]) => `<li><code>${k}</code>: ${v}</li>`)
  .join("");
export default `<figure style="margin:0">${toSVG(court, { width: 560, arcs: "svg" })}<figcaption><ul>${list}</ul></figcaption></figure>`;
