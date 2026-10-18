import { SUPER_BOWL_LIX_WP } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoPlugin, withTeamSeries } from "@sportsdataverse/sdvplot/uplot";
import type uPlot from "uplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "uPlot: Super Bowl LIX win probability in team colours, a logo at the end of each line (the options for new uPlot)",
  tags: ["uplot", "withTeamSeries", "logoPlugin", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// uPlot's data is columns: x first, then one array per series. Philadelphia (home) and Kansas City, by minute.
const minutes = SUPER_BOWL_LIX_WP.map((p) => p.minute);
const phi = SUPER_BOWL_LIX_WP.map((p) => p.home_wp);
const kc = phi.map((wp) => 1 - wp);
const data: uPlot.AlignedData = [minutes, phi, kc];

// each team's logo at its line's last point, picked by team, not by position
const last = minutes.length - 1;
const ends = [
  { minute: minutes[last], wp: phi[last], team: "PHI" },
  { minute: minutes[last], wp: kc[last], team: "KC" },
];
const pct = (v: number | null): string => (v === null ? "" : `${Math.round(v * 100)}%`);

// Built fresh per chart, as the docs do: uPlot keeps its own copy of what it is given.
const opts = (): uPlot.Options =>
  withTeamSeries<uPlot.Options>(
    {
      width: 640,
      height: 320,
      // room past 60 minutes and beyond 0% / 100% for the end logos
      scales: { x: { time: false, range: [0, 63] }, y: { range: [-0.1, 1.1] } },
      axes: [
        { label: "Minutes played", splits: () => [0, 15, 30, 45, 60] },
        { values: (_u, splits) => splits.map(pct), splits: () => [0, 0.25, 0.5, 0.75, 1] },
      ],
      series: [
        { label: "Minute" },
        { label: "Philadelphia", width: 2, value: (_u, v) => pct(v) },
        { label: "Kansas City", width: 2, value: (_u, v) => pct(v) },
      ],
      plugins: [logoPlugin(ends, { x: "minute", y: "wp", team: "team", league: "nfl", height: 0.16 })],
    },
    // row i colours series i + 1, so the lines and their logos share one team lookup
    [{ team: "PHI" }, { team: "KC" }],
    { team: "team", league: "nfl", background: "#ffffff" },
  );
// In the browser: new uPlot(opts(), data, element), as this page does.
export const browser = {
  lib: "uplot",
  opts,
  data,
  width: 640,
  height: 320,
  label:
    "Super Bowl LIX win probability by minute, Philadelphia in Eagles green and Kansas City in Chiefs red, each line ending in its team's logo",
} as const;

// uPlot draws only in a browser; without JavaScript the page shows the series it is given.
export default { series: opts().series, ends };
