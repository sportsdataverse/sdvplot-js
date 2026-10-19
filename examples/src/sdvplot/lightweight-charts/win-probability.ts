import { SUPER_BOWL_LIX_WP } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import {
  attributionNotice,
  logoMarkers,
  teamSeriesOptions,
  withAttribution,
} from "@sportsdataverse/sdvplot/lightweight-charts";
import type { Time, UTCTimestamp } from "lightweight-charts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Lightweight Charts: Super Bowl LIX win probability in team colours, read as percentages, a logo at the end of each line",
  tags: [
    "lightweight-charts",
    "teamSeriesOptions",
    "logoMarkers",
    "withAttribution",
    "attributionNotice",
    "nfl",
  ],
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

// In the browser this page calls mount with lightweight-charts' module and the chart's element.
export const browser = {
  lib: "lightweight-charts",
  mount: ({ createChart, LineSeries }: typeof import("lightweight-charts"), el: HTMLElement) => {
    // TradingView's logo (the link its licence asks for) stays on the chart
    const chart = createChart(
      el,
      withAttribution({
        width: 640,
        height: 320,
        rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { rightOffset: 12, tickMarkFormatter: (t: Time) => `${Math.round(Number(t) / 60)}'` },
        localization: { timeFormatter: (t: Time) => `${(Number(t) / 60).toFixed(1)} minutes played` },
      }),
    );
    const lines = [
      ["PHI", phi],
      ["KC", kc],
    ] as const;
    const primitives = lines.map(([team, points]) => [end(team, points)]);
    const series = lines.map(([team, points], i) => {
      const s = chart.addSeries(LineSeries, { ...line(team), title: team });
      s.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
      for (const p of primitives[i] ?? []) s.attachPrimitive(p);
      return s;
    });
    chart.timeScale().fitContent();
    // and TradingView's notice goes on the page, under the chart
    attributionNotice(el.parentElement ?? el);
    return { chart, series, primitives };
  },
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
