import * as Plot from "@observablehq/plot";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamTiers } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Team tiers",
  tags: ["plot", "teamTiers", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const rows = [
  { team: "KC", tier_no: 1 },
  { team: "BUF", tier_no: 1 },
  { team: "NYJ", tier_no: 2 },
];
export default Plot.plot(teamTiers(rows, { league: "nfl", caption: "data: nflverse" }));
