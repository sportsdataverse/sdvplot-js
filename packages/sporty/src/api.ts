import { basketballCourt } from "./basketball/court.js";
import {
  BASKETBALL_COLOR_KEYS,
  BASKETBALL_DISPLAY_RANGES,
  BASKETBALL_FEATURES,
  type BasketballColorKey,
  type BasketballDisplayRange,
} from "./basketball/types.js";
import { UnknownLeagueError } from "./errors.js";
import { footballField } from "./football/field.js";
import {
  FOOTBALL_COLOR_KEYS,
  FOOTBALL_DISPLAY_RANGES,
  FOOTBALL_FEATURES,
  type FootballColorKey,
  type FootballDisplayRange,
} from "./football/types.js";
import { hockeyRink } from "./hockey/rink.js";
import {
  HOCKEY_COLOR_KEYS,
  HOCKEY_DISPLAY_RANGES,
  HOCKEY_FEATURES,
  type HockeyColorKey,
  type HockeyDisplayRange,
} from "./hockey/types.js";
import type { Scene, Sport, SurfaceOptions } from "./scene.js";
import { BASKETBALL_LEAGUES, type BasketballParamUpdates } from "./specs/basketball.js";
import { FOOTBALL_LEAGUES, type FootballParamUpdates } from "./specs/football.js";
import { HOCKEY_LEAGUES, type HockeyParamUpdates } from "./specs/hockey.js";

const notPorted = (sport: string): UnknownLeagueError =>
  new UnknownLeagueError(`${sport} is not ported yet; see the roadmap in README`);

/** Build a surface scene for a ported sport (basketball, hockey, football); other sports throw `UnknownLeagueError`. */
export function surface(
  sport: "basketball",
  league: string,
  opts?: SurfaceOptions<BasketballParamUpdates, BasketballColorKey, BasketballDisplayRange>,
): Scene;
export function surface(
  sport: "hockey",
  league: string,
  opts?: SurfaceOptions<HockeyParamUpdates, HockeyColorKey, HockeyDisplayRange>,
): Scene;
export function surface(
  sport: "football",
  league: string,
  opts?: SurfaceOptions<FootballParamUpdates, FootballColorKey, FootballDisplayRange>,
): Scene;
export function surface(sport: Sport, league: string, opts?: object): Scene;
export function surface(sport: Sport, league: string, opts: object = {}): Scene {
  switch (sport) {
    case "basketball":
      return basketballCourt(league, opts);
    case "hockey":
      return hockeyRink(league, opts);
    case "football":
      return footballField(league, opts);
    default:
      throw notPorted(sport);
  }
}

/** League names accepted by `surface(sport, …)`. */
export function leagues(sport: "basketball"): typeof BASKETBALL_LEAGUES;
export function leagues(sport: "hockey"): typeof HOCKEY_LEAGUES;
export function leagues(sport: "football"): typeof FOOTBALL_LEAGUES;
export function leagues(sport: Sport): readonly string[];
export function leagues(sport: Sport): readonly string[] {
  if (sport === "basketball") return BASKETBALL_LEAGUES;
  if (sport === "hockey") return HOCKEY_LEAGUES;
  if (sport === "football") return FOOTBALL_LEAGUES;
  throw notPorted(sport);
}

/** Feature names a scene of this sport can contain (`Feature.name`). */
export function features(sport: "basketball"): typeof BASKETBALL_FEATURES;
export function features(sport: "hockey"): typeof HOCKEY_FEATURES;
export function features(sport: "football"): typeof FOOTBALL_FEATURES;
export function features(sport: Sport): readonly string[];
export function features(sport: Sport): readonly string[] {
  if (sport === "basketball") return BASKETBALL_FEATURES;
  if (sport === "hockey") return HOCKEY_FEATURES;
  if (sport === "football") return FOOTBALL_FEATURES;
  throw notPorted(sport);
}

/** Values accepted for `SurfaceOptions.displayRange`. */
export function displayRanges(sport: "basketball"): typeof BASKETBALL_DISPLAY_RANGES;
export function displayRanges(sport: "hockey"): typeof HOCKEY_DISPLAY_RANGES;
export function displayRanges(sport: "football"): typeof FOOTBALL_DISPLAY_RANGES;
export function displayRanges(sport: Sport): readonly string[];
export function displayRanges(sport: Sport): readonly string[] {
  if (sport === "basketball") return BASKETBALL_DISPLAY_RANGES;
  if (sport === "hockey") return HOCKEY_DISPLAY_RANGES;
  if (sport === "football") return FOOTBALL_DISPLAY_RANGES;
  throw notPorted(sport);
}

/** Keys accepted by `SurfaceOptions.colorUpdates`. */
export function colorKeys(sport: "basketball"): typeof BASKETBALL_COLOR_KEYS;
export function colorKeys(sport: "hockey"): typeof HOCKEY_COLOR_KEYS;
export function colorKeys(sport: "football"): typeof FOOTBALL_COLOR_KEYS;
export function colorKeys(sport: Sport): readonly string[];
export function colorKeys(sport: Sport): readonly string[] {
  if (sport === "basketball") return BASKETBALL_COLOR_KEYS;
  if (sport === "hockey") return HOCKEY_COLOR_KEYS;
  if (sport === "football") return FOOTBALL_COLOR_KEYS;
  throw notPorted(sport);
}
