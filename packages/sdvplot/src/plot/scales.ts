import type * as Plot from "@observablehq/plot";
import { hex6 } from "../contrast.js";
import { checkAlpha } from "../placement.js";
import type { Value } from "../resolve.js";
import { teamColorDomain } from "../team-color-domain.js";
import type { IdSystem, League, SeasonInput, Which } from "../types.js";

export interface TeamColorOptions {
  /** "primary" (default) or "secondary". */
  which?: Which;
  /** Season for era-aware resolution; passing it avoids the ambiguity warning for reused abbreviations. */
  season?: SeasonInput;
  idSystem?: IdSystem;
  strict?: boolean;
  /** Colour for values that resolve to no team; default "grey". Never gets `alpha`. */
  naValue?: string;
  /** Opacity in [0, 1], appended as an 8-bit hex alpha to team colours only. */
  alpha?: number;
  /** Domain = these distinct values; default every team_id and abbr of the league. */
  values?: readonly Value[];
  legend?: boolean;
}

/**
 * Plot colour-scale options that colour a team column by team colour. The same scale serves `fill` and
 * `stroke` (Plot has one colour scale), so `teamFill` is this function. Without `values` the domain is every
 * `team_id` and `abbr`; some abbreviations are reused across eras, so pass `season` to avoid the
 * ambiguity warning. Needs `loadLeague(league)` first.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColor } from "@sportsdataverse/sdvplot/plot";
 *
 * await loadLeague("nfl");
 * const wins = [
 *   { team: "KC", wins: 15 },
 *   { team: "BUF", wins: 13 },
 *   { team: "LAC", wins: 11 },
 * ];
 * Plot.plot({
 *   color: teamColor("nfl", { values: wins.map((w) => w.team) }),
 *   marks: [Plot.barY(wins, { x: "team", y: "wins", fill: "team" })],
 * });
 * ```
 */
export function teamColor(league: League, o: TeamColorOptions = {}): Plot.ScaleOptions {
  const naValue = o.naValue ?? "grey";
  const suffix =
    o.alpha === undefined
      ? ""
      : Math.round(checkAlpha(o.alpha) * 255)
          .toString(16)
          .padStart(2, "0");
  const { domain, colors } = teamColorDomain(league, {
    which: o.which,
    idSystem: o.idSystem,
    strict: o.strict,
    season: o.season,
    values: o.values,
  });
  const range = colors.map((c) => (c === undefined ? naValue : hex6(c) + suffix));
  return { type: "ordinal", domain, range, unknown: naValue, ...(o.legend ? { legend: true } : {}) };
}
export const teamFill: typeof teamColor = teamColor;
