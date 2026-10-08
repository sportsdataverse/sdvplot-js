import * as Plot from "@observablehq/plot";
import { STANDINGS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamTiers } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Team tiers",
  tags: ["plot", "teamTiers", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Tiers by 2024 regular-season wins: 13 or more, 8 to 12, fewer than 8.
const rows = STANDINGS.map((s) => ({ team: s.team, tier_no: s.wins >= 13 ? 1 : s.wins >= 8 ? 2 : 3 }));
export default Plot.plot(teamTiers(rows, { league: "nfl", caption: "data: nflverse, 2024 regular season" }));
