import * as Plot from "@observablehq/plot";
import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logos } from "@sportsdataverse/sdvplot/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Logo beeswarm: every team's 2024 net EPA per play (Plot.dodgeY)",
  tags: ["plot", "logos", "dodgeY", "tip", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");

const teams = NFL_TEAM_EPA_2024.map((t) => ({
  team: t.team,
  net: t.off_epa / t.off_plays - t.def_epa / t.def_plays,
}));
// height is a fraction of the frame (240 - 20 - 30 = 190 px), so each logo is 0.12 x 190 = 22.8 px tall;
// dodge's r (pixels) is half that, so neighbours just touch
export default Plot.plot({
  width: 760,
  height: 240,
  marginTop: 20,
  marginBottom: 30,
  // a short label: the tip repeats it beside the value, and Plot cuts a long tip line
  x: { label: "Net EPA/play →", tickFormat: "+.2f" },
  marks: [
    Plot.ruleX([0], { strokeOpacity: 0.3 }),
    logos(
      teams,
      Plot.dodgeY({
        league: "nfl",
        team: "team",
        x: "net",
        r: 11.4,
        height: 0.12,
        tip: { format: { x: "+.3f" } },
      }),
    ),
  ],
});
