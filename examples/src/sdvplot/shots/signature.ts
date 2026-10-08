import * as Plot from "@observablehq/plot";
import { BKN_SHOTS_2026, NBA_LEAGUE_2026 } from "@sportsdataverse/examples/data";
import { shootingSignature } from "@sportsdataverse/sdvplot/plot";
import { diffScale, fgPctByDistance, signaturePoints, vsLeague } from "@sportsdataverse/sdvplot/shots";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Shooting signature against the league",
  tags: ["plot", "shots", "shootingSignature", "signaturePoints", "fgPctByDistance", "vsLeague", "nba"],
} satisfies ExampleMeta;

// FG% by distance for Brooklyn's first 2000 shots of 2025-26, as wide as the share of shots taken from there and
// coloured by FG% minus the 2025-26 league's (the dashed line), shrunk toward the league by 25 attempts.
const points = signaturePoints(vsLeague(fgPctByDistance(BKN_SHOTS_2026), NBA_LEAGUE_2026.byFoot));
// diffScale's domain is a fraction (0.15 is 15 points): label the ticks in points, as d3's appendLegend does
const pts = (d: number): string => (d === 0 ? "0" : `${d > 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1)}`);

const figure = document.createElement("div");
figure.append(
  Plot.plot({
    width: 640,
    x: { label: "Distance (ft)" },
    y: { domain: [0, 1], label: "FG%", tickFormat: "%" },
    marks: shootingSignature(points, { tip: true }),
  }),
  Plot.legend({ color: { ...diffScale().plot, label: "FG% vs league (points)", tickFormat: pts } }),
);
export default figure;
