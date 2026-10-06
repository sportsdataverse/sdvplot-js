import type * as Plot from "@observablehq/plot";
import { teamColorsSync } from "../colors.js";
import { hex6 } from "../contrast.js";
import { getLeagueSync } from "../index-data.js";
import { checkAlpha } from "../placement.js";
import type { Value } from "../resolve.js";
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

const has = (v: Value): v is string | number => v !== null && v !== undefined && !Number.isNaN(v);

/**
 * Plot colour-scale options that colour a team column by team colour. The same scale serves `fill` and
 * `stroke` (Plot has one colour scale), so `teamFill` is this function. Without `values` the domain is every
 * `team_id` and `abbr`; some abbreviations are reused across eras, so pass `season` to avoid the
 * ambiguity warning. Needs `loadLeague(league)` first.
 */
export function teamColor(league: League, o: TeamColorOptions = {}): Plot.ScaleOptions {
  const naValue = o.naValue ?? "grey";
  const suffix =
    o.alpha === undefined
      ? ""
      : Math.round(checkAlpha(o.alpha) * 255)
          .toString(16)
          .padStart(2, "0");
  const domain = o.values
    ? [...new Set(o.values.filter(has).map(String))]
    : [...new Set(getLeagueSync(league).teams.flatMap((t) => (t.abbr ? [t.team_id, t.abbr] : [t.team_id])))];
  const colors = teamColorsSync(league, domain, {
    which: o.which ?? "primary",
    idSystem: o.idSystem ?? "auto",
    strict: o.strict ?? false,
    ...(o.season !== undefined ? { season: o.season } : {}),
  });
  const range = colors.map((c) => (c === undefined ? naValue : hex6(c) + suffix));
  return { type: "ordinal", domain, range, unknown: naValue, ...(o.legend ? { legend: true } : {}) };
}
export const teamFill: typeof teamColor = teamColor;
