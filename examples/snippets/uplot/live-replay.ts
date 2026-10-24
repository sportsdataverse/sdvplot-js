// live-replay.ts: Super Bowl LIX replayed one play at a time, as a live feed would arrive. Browser only; peer: uplot.
import { SUPER_BOWL_LIX_WP } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { type UPlotLike, logoPlugin, withTeamSeries } from "@sportsdataverse/sdvplot/uplot";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

/** Draws the replay into `el`, one play every `ms`; returns what stops it. */
export async function replay(el: HTMLElement, ms = 100): Promise<() => void> {
  await loadLeague("nfl");
  // the columns the feed appends to: minutes played, then each team's win probability
  const minutes: number[] = [];
  const phi: number[] = [];
  const kc: number[] = [];
  // a logo at each line's newest point: a function of the chart, so the plugin reads it again at every draw
  const ends = (u: UPlotLike) => {
    const [xs, home, away] = u.data;
    const i = (xs?.length ?? 0) - 1;
    if (i < 0) return [];
    return [
      { minute: xs?.[i], wp: home?.[i], team: "PHI" },
      { minute: xs?.[i], wp: away?.[i], team: "KC" },
    ];
  };
  const opts = withTeamSeries<uPlot.Options>(
    {
      width: 640,
      height: 320,
      scales: { x: { time: false, range: [0, 63] }, y: { range: [-0.1, 1.1] } },
      series: [{ label: "Minute" }, { label: "Philadelphia", width: 2 }, { label: "Kansas City", width: 2 }],
      plugins: [logoPlugin(ends, { x: "minute", y: "wp", team: "team", league: "nfl", height: 0.16 })],
    },
    [{ team: "PHI" }, { team: "KC" }],
    { team: "team", league: "nfl", background: "#ffffff" },
  );
  const u = new uPlot(opts, [minutes, phi, kc], el);
  let next = 0;
  const timer = setInterval(() => {
    const play = SUPER_BOWL_LIX_WP[next++];
    if (play === undefined) return clearInterval(timer);
    minutes.push(play.minute);
    phi.push(play.home_wp);
    kc.push(1 - play.home_wp);
    // the append is uPlot's own: the team colours live in the options, and the logos move with the data
    u.setData([minutes, phi, kc]);
  }, ms);
  return () => {
    clearInterval(timer);
    u.destroy();
  };
}
