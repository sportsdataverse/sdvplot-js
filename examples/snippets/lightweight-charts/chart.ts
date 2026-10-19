import { loadLeague } from "@sportsdataverse/sdvplot";
import {
  attributionNotice,
  logoMarkers,
  teamSeriesOptions,
  withAttribution,
} from "@sportsdataverse/sdvplot/lightweight-charts";
import { type IChartApi, LineSeries, type UTCTimestamp, createChart } from "lightweight-charts";

/**
 * A team's win-probability line in `el` (a browser module): TradingView's logo on the chart, its notice on the page
 * under it, and the team's logo at the line's last point. `points` are seconds played and win probabilities.
 */
export async function winProbabilityChart(
  el: HTMLElement,
  team: string,
  points: readonly { time: number; value: number }[],
): Promise<IChartApi> {
  await loadLeague("nfl");
  const chart = createChart(el, withAttribution({ width: 640, height: 320 }));
  const line = chart.addSeries(LineSeries, teamSeriesOptions(team, { league: "nfl", units: "probability" }));
  line.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
  const last = points.at(-1);
  if (last !== undefined)
    line.attachPrimitive(
      logoMarkers([{ ...last, team }], {
        x: "time",
        y: "value",
        team: "team",
        league: "nfl",
        units: "probability",
      }),
    );
  attributionNotice(el.parentElement ?? el);
  return chart;
}
