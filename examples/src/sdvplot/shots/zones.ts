import * as Plot from "@observablehq/plot";
import { BKN_SHOTS_2026, NBA_LEAGUE_2026 } from "@sportsdataverse/examples/data";
import { shotZones, surface } from "@sportsdataverse/sdvplot/plot";
import { diffScale, shrunkDiff, statsByZone } from "@sportsdataverse/sdvplot/shots";
import { type BasketballZone, basketballZones } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Shot zones against the league (blazing-the-nets main's zones mode)",
  tags: ["plot", "shots", "shotZones", "statsByZone", "shrunkDiff", "basketballZones", "nba"],
} satisfies ExampleMeta;

// Brooklyn's first 2000 shots of 2025-26 by zone, each zone filled by its FG% minus the 2025-26 league's in that
// zone, shrunk toward the league by 25 attempts, and labelled makes/attempts.
const player = statsByZone(BKN_SHOTS_2026);
const league = NBA_LEAGUE_2026.hex15.zones;
const colour = diffScale();
const diff = (z: BasketballZone): number | null => {
  const rate = league[z].fgPct;
  return rate === null ? null : shrunkDiff(player[z].makes, player[z].attempts, rate);
};

// The zones are built in legacy tenths (scale: 10), so they take the shots' frame to land on this court.
const court = surface("nba", { displayRange: "defense", rotation: 90 });
export default Plot.plot({
  ...court.scales,
  width: 500,
  marks: [
    ...court.marks,
    ...shotZones(basketballZones("nba", { scale: 10, top: 350 }), {
      fill: (z) => colour(diff(z)),
      text: (z) => `${player[z].makes}/${player[z].attempts}`,
      frame: "nba-legacy-vertical",
    }),
  ],
});
