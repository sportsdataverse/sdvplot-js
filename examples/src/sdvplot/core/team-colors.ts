import { STANDINGS } from "@sportsdataverse/examples/data";
import { teamColors, teamColorsSync } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Primary and secondary colours",
  tags: ["teamColors", "colors", "nfl"],
} satisfies ExampleMeta;

const teams = STANDINGS.map((s) => s.team);
const primary = await teamColors("nfl", teams); // loads the league, then one colour per value
const secondary = teamColorsSync("nfl", teams, { which: "secondary" }); // the league is loaded now

export default Object.fromEntries(teams.map((t, i) => [t, { primary: primary[i], secondary: secondary[i] }]));
