import { SPORTS, colorKeys, displayRanges, features, leagues } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "What each sport offers: leagues, ranges, features, colour keys",
  tags: ["discovery", "SPORTS", "leagues", "features", "displayRanges", "colorKeys"],
} satisfies ExampleMeta;

// The discovery tables are the same lists the option types are built from, so they never drift from the API.
export default Object.fromEntries(
  SPORTS.map((sport) => [
    sport,
    {
      leagues: leagues(sport).join(", "),
      displayRanges: displayRanges(sport).length,
      features: features(sport).length,
      colorKeys: colorKeys(sport).length,
      "displayRanges (first 6)": displayRanges(sport).slice(0, 6).join(", "),
    },
  ]),
);
