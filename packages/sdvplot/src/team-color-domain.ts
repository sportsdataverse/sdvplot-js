import { teamColorsSync } from "./colors.js";
import { getLeagueSync } from "./index-data.js";
import type { Value } from "./resolve.js";
import type { IdSystem, League, SeasonInput, Which } from "./types.js";

export interface TeamColorDomainOptions {
  which?: Which | undefined;
  season?: SeasonInput | undefined;
  idSystem?: IdSystem | undefined;
  strict?: boolean | undefined;
  /** Domain = these distinct values; default every team_id and abbr of the league. */
  values?: readonly Value[] | undefined;
}
const has = (v: Value): v is string | number => v !== null && v !== undefined && !Number.isNaN(v);

/** Plot-free: the ordinal domain and the matching team colours (undefined where a value resolves to no team). Shared by `teamColor` (Plot) and `teamColorScale` (d3). */
export function teamColorDomain(
  league: League,
  o: TeamColorDomainOptions = {},
): { domain: string[]; colors: (string | undefined)[] } {
  const domain = o.values
    ? [...new Set(o.values.filter(has).map(String))]
    : [...new Set(getLeagueSync(league).teams.flatMap((t) => (t.abbr ? [t.team_id, t.abbr] : [t.team_id])))];
  const colors = teamColorsSync(league, domain, {
    which: o.which ?? "primary",
    idSystem: o.idSystem ?? "auto",
    strict: o.strict ?? false,
    ...(o.season !== undefined ? { season: o.season } : {}),
  });
  return { domain, colors };
}
