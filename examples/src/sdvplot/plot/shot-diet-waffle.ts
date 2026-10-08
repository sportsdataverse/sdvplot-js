import * as Plot from "@observablehq/plot";
import { BKN_SHOTS_2026 } from "@sportsdataverse/examples/data";
import { statsByZone } from "@sportsdataverse/sdvplot/shots";
import { BASKETBALL_ZONES, BASKETBALL_ZONE_LABELS } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Shot diet: 2,000 Nets attempts by zone, one square per 10 shots (Plot.waffleY)",
  tags: ["plot", "waffleY", "statsByZone", "nba"],
} satisfies ExampleMeta;

const byZone = statsByZone(BKN_SHOTS_2026);
const diet = BASKETBALL_ZONES.map((zone) => ({
  zone: BASKETBALL_ZONE_LABELS[zone],
  attempts: byZone[zone].attempts,
}));
export default Plot.plot({
  width: 640,
  height: 320,
  x: { label: null, domain: diet.map((d) => d.zone) },
  y: { label: "↑ Attempts" },
  marks: [
    Plot.waffleY(diet, { x: "zone", y: "attempts", unit: 10, channels: { Zone: "zone" }, tip: true }),
    Plot.ruleY([0]),
  ],
});
