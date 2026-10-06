import type { League } from "./data/index.js";
import { NFL_GSIS } from "./data/nfl_gsis.js";
import { InputError } from "./errors.js";
import { normValue } from "./normalize.js";
import type { Value } from "./resolve.js";
import type { HeadshotIdSystem } from "./types.js";

/** Port of `_headshots.ESPN_HEADSHOT_LEAGUES`. */
export const ESPN_HEADSHOT_LEAGUES: Readonly<Record<string, string>> = {
  nfl: "nfl",
  nba: "nba",
  wnba: "wnba",
  mlb: "mlb",
  nhl: "nhl",
  cfb: "college-football",
  mbb: "mens-college-basketball",
  wbb: "womens-college-basketball",
};

/** Width / height of a headshot image box (the ESPN combiner crop). */
export const HEADSHOT_ASPECT: number = 600 / 436;

// League-id CDN builders, ported from sdvplotR `league_headshot_url`.
export function nbaHeadshotUrl(id: string | number): string {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`;
}
export function wnbaHeadshotUrl(id: string | number): string {
  return `https://cdn.wnba.com/headshots/wnba/latest/260x190/${id}.png`;
}
export function mlbHeadshotUrl(id: string | number): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${id}/headshot/67/current.png`;
}
export function nhlHeadshotUrl(id: string | number): string {
  return `https://assets.nhle.com/mugs/nhl/latest/${id}.png`;
}

function espn(id: string, league: string): string | undefined {
  if (!/^\d+$/.test(id)) return undefined;
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/${ESPN_HEADSHOT_LEAGUES[league]}/players/full/${id}.png`;
}

/** Sync port of `_headshots.headshot_url`; the gsis map is bundled, so nothing is downloaded. */
export function headshotUrl(
  playerId: Value,
  league: League,
  { idSystem = "espn" }: { idSystem?: HeadshotIdSystem } = {},
): string | undefined {
  if (idSystem === "espn" && !Object.hasOwn(ESPN_HEADSHOT_LEAGUES, league))
    throw new InputError(
      `no ESPN headshots for league ${JSON.stringify(league)}; supported: ${Object.keys(ESPN_HEADSHOT_LEAGUES).sort().join(", ")}`,
    );
  if (idSystem !== "espn" && !(idSystem === "gsis" && league === "nfl"))
    throw new InputError(
      `idSystem must be 'espn' (any league) or 'gsis' (nfl), got ${JSON.stringify(idSystem)} for ${JSON.stringify(league)}`,
    );
  const pid = normValue(playerId);
  if (pid === null) return undefined;
  if (idSystem === "espn") return espn(pid, league);
  const row = Object.hasOwn(NFL_GSIS, String(playerId).trim())
    ? NFL_GSIS[String(playerId).trim()]
    : undefined;
  if (!row) return undefined;
  if (row.headshot) {
    const t = row.headshot.replace("/f_auto,q_auto/", "/t_headshot_desktop/f_auto/");
    return t.endsWith(".png") ? t : `${t}.png`;
  }
  return row.espn_id ? espn(row.espn_id, "nfl") : undefined;
}
