import { STANDINGS } from "@sportsdataverse/examples/data";
import {
  ESPN_HEADSHOT_LEAGUES,
  HEADSHOT_ASPECT,
  headshotUrl,
  mlbHeadshotUrl,
  nbaHeadshotUrl,
  nhlHeadshotUrl,
  wnbaHeadshotUrl,
} from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Headshot URLs",
  tags: ["headshots", "urls"],
} satisfies ExampleMeta;

// ESPN player ids work in every league ESPN_HEADSHOT_LEAGUES lists; nothing is loaded or fetched.
const espn = Object.fromEntries(STANDINGS.slice(0, 3).map((s) => [s.qb, headshotUrl(s.qb_espn_id, "nfl")]));

export default {
  espn,
  // Each league's own CDN, by that league's player id.
  "LeBron James (nba 2544)": nbaHeadshotUrl(2544),
  "A'ja Wilson (wnba 1628932)": wnbaHeadshotUrl(1628932),
  "Shohei Ohtani (mlb 660271)": mlbHeadshotUrl(660271),
  "Connor McDavid (nhl 8478402)": nhlHeadshotUrl(8478402),
  HEADSHOT_ASPECT: HEADSHOT_ASPECT.toFixed(3), // width / height of an ESPN headshot box
  ESPN_HEADSHOT_LEAGUES,
};
