import * as Plot from "@observablehq/plot";
import { type TierRow, type TiersOptions, prepareTiers } from "../tiers.js";
import type { League } from "../types.js";
import { logos } from "./marks.js";

/** Options for a tier plot (see `prepareTiers`), plus `devel` (draw team abbreviations as text, not logos) and `width` (px, default 640). */
export type TeamTiersOptions = TiersOptions & {
  league: League;
  devel?: boolean;
  width?: number;
  /** Plot's tip on the logos, naming the team on hover (opt-in; default false). Ignored with `devel`. */
  tip?: boolean;
};

/**
 * A tier plot as `Plot.plot` options (SSR-composable; the caller runs `Plot.plot`): tier 1 on top, logos ranked
 * within each tier, separator rules, wrapped tier labels on the y axis.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamTiers } from "@sportsdataverse/sdvplot/plot";
 *
 * await loadLeague("nfl");
 * const rows = [
 *   { team: "BUF", tier_no: 1 },
 *   { team: "KC", tier_no: 1 },
 *   { team: "MIA", tier_no: 2 },
 *   { team: "NE", tier_no: 3 },
 * ];
 * Plot.plot(teamTiers(rows, { league: "nfl" }));
 * ```
 */
export function teamTiers(rows: readonly TierRow[], o: TeamTiersOptions): Plot.PlotOptions {
  const t = prepareTiers(rows, o.league, o);
  const pts = t.x.map((x, i) => ({
    x,
    y: t.y[i] as number,
    team: t.teamIds[i] as string,
    label: t.labels[i] as string,
  }));
  const marks: Plot.Markish[] = [
    Plot.ruleY(t.lines, { stroke: t.theme.line }),
    o.devel
      ? Plot.text(pts, { x: "x", y: "y", text: "label", fill: t.theme.text, fontWeight: "bold" })
      : logos(pts, {
          league: o.league,
          x: "x",
          y: "y",
          team: "team",
          idSystem: "team_id",
          height: t.height,
          alpha: t.alpha,
          variant: t.variant,
          ...(o.tip ? { tip: true, title: "label" } : {}),
        }),
  ];
  return {
    width: o.width ?? 640,
    height: 480,
    marginLeft: 110,
    style: { background: t.theme.bg, color: t.theme.text, fontFamily: "sans-serif" },
    ...(t.title ? { title: t.title, ariaLabel: t.title } : {}), // the figure is named by its title
    ...(t.subtitle ? { subtitle: t.subtitle } : {}),
    ...(t.caption ? { caption: t.caption } : {}),
    x: { domain: t.xlim, axis: null },
    y: {
      domain: t.ylim,
      reverse: true,
      ticks: t.breaks,
      tickFormat: (d: number) => t.breakLabels[t.breaks.indexOf(d)] ?? "",
      tickSize: 0,
      label: null,
      fontWeight: "bold",
    } as Plot.ScaleOptions,
    marks,
  };
}
