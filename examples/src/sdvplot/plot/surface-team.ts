import * as Plot from "@observablehq/plot";
import { loadLeague, teamColorsSync } from "@sportsdataverse/sdvplot";
import { SURFACES, SURFACE_BASE, colorUpdates, surface } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "A field in team colours",
  tags: ["plot", "surface", "colorUpdates", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const red = teamColorsSync("nfl", "KC") ?? SURFACE_BASE.football;
const gold = teamColorsSync("nfl", "KC", { which: "secondary" }) ?? SURFACE_BASE.football;
// What `team` paints, keyed by sporty colour key: both end zones in the primary colour.
const painted = colorUpdates("football", red, gold);
// colorUpdates overrides any key on top of that: here the defensive end zone takes the secondary colour.
const field = surface("nfl", { team: "KC", colorUpdates: { defensive_endzone: gold }, centerLogo: true });

export default Plot.plot({
  ...field.scales,
  width: 800,
  caption: `team "KC" paints ${Object.keys(painted).join(", ")}; nfl draws sporty's ${SURFACES.nfl?.join(" ")} surface (${Object.keys(SURFACES).length} leagues have one)`,
  marks: field.marks,
});
