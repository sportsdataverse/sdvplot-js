import * as Plot from "@observablehq/plot";
import { loadLeague, teamColorsSync } from "@sportsdataverse/sdvplot";
import { SURFACES, surface } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "An NCAA softball field with its chalk in Texas orange and the Longhorns' logo in shallow centre field",
  tags: ["plot", "surface", "colorUpdates", "centerLogo", "teamColorsSync", "softball", "ncaa_softball"],
} satisfies ExampleMeta;

await loadLeague("ncaa_softball");
// ncaa_softball is both an sdv team league and a surface key: `team` resolves against the league's teams, and the
// softball field takes no team paint of its own, so the team colour goes on through colorUpdates.
const orange = teamColorsSync("ncaa_softball", "TEX") ?? "#ffffff";
const chalk = [
  "foul_line",
  "batters_box",
  "catchers_box",
  "running_lane",
  "pitchers_circle",
  "coaches_box",
] as const;
const field = surface("ncaa_softball", {
  team: "TEX",
  colorUpdates: Object.fromEntries(chalk.map((k) => [k, orange])),
  // the field's origin is home plate, so the logo goes in shallow centre field (as sdvplotR and sdvplot), dark on grass
  centerLogo: true,
});

export default Plot.plot({
  ...field.scales,
  width: 640,
  caption: `ncaa_softball draws sporty's ${SURFACES.ncaa_softball?.join(" ")} field; Texas (${orange}) on the chalk lines and its logo in shallow centre field`,
  marks: field.marks,
});
