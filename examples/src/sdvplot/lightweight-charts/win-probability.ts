import { SUPER_BOWL_LIX_WP } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { logoMarkers, teamSeriesOptions, withAttribution } from "@sportsdataverse/sdvplot/lightweight-charts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Lightweight Charts: Super Bowl LIX win probability in team colours, read as percentages, a logo at the end of each line",
  tags: ["lightweight-charts", "teamSeriesOptions", "logoMarkers", "withAttribution", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// Lightweight Charts' x is a time in seconds and must rise strictly: seconds played, keeping the last play at each
// second (two plays can start on one clock reading, as the two pregame rows at 0:00 do).
const bySecond = new Map<number, number>();
for (const p of SUPER_BOWL_LIX_WP) bySecond.set(Math.round(p.minute * 60), p.home_wp);
const phi = [...bySecond].map(([time, value]) => ({ time, value }));
// a two-team game: Kansas City's win probability is 1 - home_wp, derived from the home series, not a column of its own
const kc = phi.map((p) => ({ time: p.time, value: 1 - p.value }));

const teams = ["PHI", "KC"];
const line = (team: string) =>
  teamSeriesOptions(team, { league: "nfl", teams, units: "probability", background: "#ffffff" });
// each team's logo at its own line's last point
const end = (team: string, points: readonly { time: number; value: number }[]) => {
  const last = points[points.length - 1];
  if (last === undefined) throw new Error(`no points for ${team}`);
  return logoMarkers([{ ...last, team }], {
    x: "time",
    y: "value",
    team: "team",
    league: "nfl",
    units: "probability",
    height: 0.12,
  });
};

// In the browser: createChart(element, chart()), then one addSeries(LineSeries, options()) per line, its setData, and
// attachPrimitive for its logo, as this page does. withAttribution keeps TradingView's attribution logo (its link) on
// the chart, and the page shows TradingView's notice (TRADINGVIEW_NOTICE) under it, as Lightweight Charts' licence asks.
export const browser = {
  lib: "lightweight-charts",
  chart: () =>
    withAttribution({
      rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { rightOffset: 12, tickMarkFormatter: (t: number) => `${Math.round(t / 60)}'` },
      localization: { timeFormatter: (t: number) => `${(t / 60).toFixed(1)} minutes played` },
    }),
  series: [
    { options: () => ({ ...line("PHI"), title: "PHI" }), data: phi, primitives: () => [end("PHI", phi)] },
    { options: () => ({ ...line("KC"), title: "KC" }), data: kc, primitives: () => [end("KC", kc)] },
  ],
  width: 640,
  height: 320,
  label:
    "Super Bowl LIX win probability by minute, Philadelphia in Eagles green and Kansas City in Chiefs red, each line ending in its team's logo",
} as const;

// Lightweight Charts draws only in a browser; without JavaScript the page shows each line and its final reading.
export default {
  lines: teams.map((team, i) => {
    const o = line(team);
    const final = (i === 0 ? phi : kc).at(-1)?.value ?? Number.NaN;
    return { team, color: o.color, final: o.priceFormat?.formatter(final) };
  }),
};
