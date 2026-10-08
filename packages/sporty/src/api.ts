import { baseballField } from "./baseball/field.js";
import {
  BASEBALL_COLOR_KEYS,
  BASEBALL_DISPLAY_RANGES,
  BASEBALL_FEATURES,
  type BaseballColorKey,
  type BaseballDisplayRange,
} from "./baseball/types.js";
import { basketballCourt } from "./basketball/court.js";
import {
  BASKETBALL_COLOR_KEYS,
  BASKETBALL_DISPLAY_RANGES,
  BASKETBALL_FEATURES,
  type BasketballColorKey,
  type BasketballDisplayRange,
} from "./basketball/types.js";
import { curlingSheet } from "./curling/sheet.js";
import {
  CURLING_COLOR_KEYS,
  CURLING_DISPLAY_RANGES,
  CURLING_FEATURES,
  type CurlingColorKey,
  type CurlingDisplayRange,
} from "./curling/types.js";
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
import { lacrosseField } from "./lacrosse/field.js";
import {
  LACROSSE_COLOR_KEYS,
  LACROSSE_DISPLAY_RANGES,
  LACROSSE_FEATURES,
  type LacrosseColorKey,
  type LacrosseDisplayRange,
} from "./lacrosse/types.js";
import type { Scene, Sport, SurfaceOptions } from "./scene.js";
import { soccerPitch } from "./soccer/pitch.js";
import {
  SOCCER_COLOR_KEYS,
  SOCCER_DISPLAY_RANGES,
  SOCCER_FEATURES,
  type SoccerColorKey,
  type SoccerDisplayRange,
} from "./soccer/types.js";
import { BASEBALL_LEAGUES, type BaseballLeague, type BaseballParamUpdates } from "./specs/baseball.js";
import {
  BASKETBALL_LEAGUES,
  type BasketballLeague,
  type BasketballParamUpdates,
} from "./specs/basketball.js";
import { CURLING_LEAGUES, type CurlingLeague, type CurlingParamUpdates } from "./specs/curling.js";
import { FOOTBALL_LEAGUES, type FootballLeague, type FootballParamUpdates } from "./specs/football.js";
import { HOCKEY_LEAGUES, type HockeyLeague, type HockeyParamUpdates } from "./specs/hockey.js";
import { LACROSSE_LEAGUES, type LacrosseLeague, type LacrosseParamUpdates } from "./specs/lacrosse.js";
import { SOCCER_LEAGUES, type SoccerLeague, type SoccerParamUpdates } from "./specs/soccer.js";
import { TENNIS_LEAGUES, type TennisLeague, type TennisParamUpdates } from "./specs/tennis.js";
import {
  VOLLEYBALL_LEAGUES,
  type VolleyballLeague,
  type VolleyballParamUpdates,
} from "./specs/volleyball.js";
import { tennisCourt } from "./tennis/court.js";
import {
  TENNIS_COLOR_KEYS,
  TENNIS_DISPLAY_RANGES,
  TENNIS_FEATURES,
  type TennisColorKey,
  type TennisDisplayRange,
} from "./tennis/types.js";
import { volleyballCourt } from "./volleyball/court.js";
import {
  VOLLEYBALL_COLOR_KEYS,
  VOLLEYBALL_DISPLAY_RANGES,
  VOLLEYBALL_FEATURES,
  type VolleyballColorKey,
  type VolleyballDisplayRange,
} from "./volleyball/types.js";

/** Every sport `surface()` accepts, alphabetical. */
export const SPORTS = [
  "baseball",
  "basketball",
  "curling",
  "football",
  "hockey",
  "lacrosse",
  "soccer",
  "tennis",
  "volleyball",
] as const;

const unknownSport = (sport: string): UnknownLeagueError =>
  new UnknownLeagueError(`Unknown sport "${sport}"; expected one of: ${SPORTS.join(", ")}`);

/** League accepted by `surface(sport, …)` for sport `S` (a generated league name; any string compiles). */
export type LeagueOf<S extends Sport> = S extends "baseball"
  ? BaseballLeague | (string & {})
  : S extends "basketball"
    ? BasketballLeague | (string & {})
    : S extends "curling"
      ? CurlingLeague | (string & {})
      : S extends "football"
        ? FootballLeague | (string & {})
        : S extends "hockey"
          ? HockeyLeague | (string & {})
          : S extends "lacrosse"
            ? LacrosseLeague | (string & {})
            : S extends "soccer"
              ? SoccerLeague | (string & {})
              : S extends "tennis"
                ? TennisLeague | (string & {})
                : S extends "volleyball"
                  ? VolleyballLeague | (string & {})
                  : never;

/** `surface()` options for sport `S`. */
export type OptionsOf<S extends Sport> = S extends "baseball"
  ? SurfaceOptions<BaseballParamUpdates, BaseballColorKey, BaseballDisplayRange>
  : S extends "basketball"
    ? SurfaceOptions<BasketballParamUpdates, BasketballColorKey, BasketballDisplayRange>
    : S extends "curling"
      ? SurfaceOptions<CurlingParamUpdates, CurlingColorKey, CurlingDisplayRange>
      : S extends "football"
        ? SurfaceOptions<FootballParamUpdates, FootballColorKey, FootballDisplayRange>
        : S extends "hockey"
          ? SurfaceOptions<HockeyParamUpdates, HockeyColorKey, HockeyDisplayRange>
          : S extends "lacrosse"
            ? SurfaceOptions<LacrosseParamUpdates, LacrosseColorKey, LacrosseDisplayRange>
            : S extends "soccer"
              ? SurfaceOptions<SoccerParamUpdates, SoccerColorKey, SoccerDisplayRange>
              : S extends "tennis"
                ? SurfaceOptions<TennisParamUpdates, TennisColorKey, TennisDisplayRange>
                : S extends "volleyball"
                  ? SurfaceOptions<VolleyballParamUpdates, VolleyballColorKey, VolleyballDisplayRange>
                  : never;

/**
 * Build a surface scene for any of the nine sports. Options are typed per sport, so a misspelled option, colour key
 * or display range compiles to an error. A runtime `Sport` (or a union) goes through the generic overload; an unknown
 * sport (untyped callers) or league throws `UnknownLeagueError`.
 */
export function surface(
  sport: "baseball",
  league: BaseballLeague | (string & {}),
  opts?: SurfaceOptions<BaseballParamUpdates, BaseballColorKey, BaseballDisplayRange>,
): Scene;
export function surface(
  sport: "basketball",
  league: BasketballLeague | (string & {}),
  opts?: SurfaceOptions<BasketballParamUpdates, BasketballColorKey, BasketballDisplayRange>,
): Scene;
export function surface(
  sport: "curling",
  league: CurlingLeague | (string & {}),
  opts?: SurfaceOptions<CurlingParamUpdates, CurlingColorKey, CurlingDisplayRange>,
): Scene;
export function surface(
  sport: "football",
  league: FootballLeague | (string & {}),
  opts?: SurfaceOptions<FootballParamUpdates, FootballColorKey, FootballDisplayRange>,
): Scene;
export function surface(
  sport: "hockey",
  league: HockeyLeague | (string & {}),
  opts?: SurfaceOptions<HockeyParamUpdates, HockeyColorKey, HockeyDisplayRange>,
): Scene;
export function surface(
  sport: "lacrosse",
  league: LacrosseLeague | (string & {}),
  opts?: SurfaceOptions<LacrosseParamUpdates, LacrosseColorKey, LacrosseDisplayRange>,
): Scene;
export function surface(
  sport: "soccer",
  league: SoccerLeague | (string & {}),
  opts?: SurfaceOptions<SoccerParamUpdates, SoccerColorKey, SoccerDisplayRange>,
): Scene;
export function surface(
  sport: "tennis",
  league: TennisLeague | (string & {}),
  opts?: SurfaceOptions<TennisParamUpdates, TennisColorKey, TennisDisplayRange>,
): Scene;
export function surface(
  sport: "volleyball",
  league: VolleyballLeague | (string & {}),
  opts?: SurfaceOptions<VolleyballParamUpdates, VolleyballColorKey, VolleyballDisplayRange>,
): Scene;
export function surface<S extends Sport>(sport: S, league: LeagueOf<S>, opts?: OptionsOf<S>): Scene;
export function surface(sport: Sport, league: string, opts: object = {}): Scene {
  switch (sport) {
    case "baseball":
      return baseballField(league, opts);
    case "basketball":
      return basketballCourt(league, opts);
    case "curling":
      return curlingSheet(league, opts);
    case "football":
      return footballField(league, opts);
    case "hockey":
      return hockeyRink(league, opts);
    case "lacrosse":
      return lacrosseField(league, opts);
    case "soccer":
      return soccerPitch(league, opts);
    case "tennis":
      return tennisCourt(league, opts);
    case "volleyball":
      return volleyballCourt(league, opts);
    default:
      sport satisfies never;
      throw unknownSport(String(sport));
  }
}

interface Discovery {
  leagues: readonly string[];
  features: readonly string[];
  displayRanges: readonly string[];
  colorKeys: readonly string[];
}

const DISCOVERY: Readonly<Record<Sport, Discovery>> = {
  baseball: {
    leagues: BASEBALL_LEAGUES,
    features: BASEBALL_FEATURES,
    displayRanges: BASEBALL_DISPLAY_RANGES,
    colorKeys: BASEBALL_COLOR_KEYS,
  },
  basketball: {
    leagues: BASKETBALL_LEAGUES,
    features: BASKETBALL_FEATURES,
    displayRanges: BASKETBALL_DISPLAY_RANGES,
    colorKeys: BASKETBALL_COLOR_KEYS,
  },
  curling: {
    leagues: CURLING_LEAGUES,
    features: CURLING_FEATURES,
    displayRanges: CURLING_DISPLAY_RANGES,
    colorKeys: CURLING_COLOR_KEYS,
  },
  football: {
    leagues: FOOTBALL_LEAGUES,
    features: FOOTBALL_FEATURES,
    displayRanges: FOOTBALL_DISPLAY_RANGES,
    colorKeys: FOOTBALL_COLOR_KEYS,
  },
  hockey: {
    leagues: HOCKEY_LEAGUES,
    features: HOCKEY_FEATURES,
    displayRanges: HOCKEY_DISPLAY_RANGES,
    colorKeys: HOCKEY_COLOR_KEYS,
  },
  lacrosse: {
    leagues: LACROSSE_LEAGUES,
    features: LACROSSE_FEATURES,
    displayRanges: LACROSSE_DISPLAY_RANGES,
    colorKeys: LACROSSE_COLOR_KEYS,
  },
  soccer: {
    leagues: SOCCER_LEAGUES,
    features: SOCCER_FEATURES,
    displayRanges: SOCCER_DISPLAY_RANGES,
    colorKeys: SOCCER_COLOR_KEYS,
  },
  tennis: {
    leagues: TENNIS_LEAGUES,
    features: TENNIS_FEATURES,
    displayRanges: TENNIS_DISPLAY_RANGES,
    colorKeys: TENNIS_COLOR_KEYS,
  },
  volleyball: {
    leagues: VOLLEYBALL_LEAGUES,
    features: VOLLEYBALL_FEATURES,
    displayRanges: VOLLEYBALL_DISPLAY_RANGES,
    colorKeys: VOLLEYBALL_COLOR_KEYS,
  },
};

/** The discovery tables of `sport`; an unknown sport (untyped callers) throws `UnknownLeagueError`. */
function discovery(sport: string): Discovery {
  if (!(SPORTS as readonly string[]).includes(sport)) throw unknownSport(sport);
  return DISCOVERY[sport as Sport];
}

/** League names accepted by `surface(sport, …)` (`custom` builds from all-zero defaults). */
export function leagues(sport: "baseball"): typeof BASEBALL_LEAGUES;
export function leagues(sport: "basketball"): typeof BASKETBALL_LEAGUES;
export function leagues(sport: "curling"): typeof CURLING_LEAGUES;
export function leagues(sport: "football"): typeof FOOTBALL_LEAGUES;
export function leagues(sport: "hockey"): typeof HOCKEY_LEAGUES;
export function leagues(sport: "lacrosse"): typeof LACROSSE_LEAGUES;
export function leagues(sport: "soccer"): typeof SOCCER_LEAGUES;
export function leagues(sport: "tennis"): typeof TENNIS_LEAGUES;
export function leagues(sport: "volleyball"): typeof VOLLEYBALL_LEAGUES;
export function leagues(sport: Sport): readonly string[];
export function leagues(sport: Sport): readonly string[] {
  return discovery(sport).leagues;
}

/** Feature names a scene of this sport can contain (`Feature.name`). */
export function features(sport: "baseball"): typeof BASEBALL_FEATURES;
export function features(sport: "basketball"): typeof BASKETBALL_FEATURES;
export function features(sport: "curling"): typeof CURLING_FEATURES;
export function features(sport: "football"): typeof FOOTBALL_FEATURES;
export function features(sport: "hockey"): typeof HOCKEY_FEATURES;
export function features(sport: "lacrosse"): typeof LACROSSE_FEATURES;
export function features(sport: "soccer"): typeof SOCCER_FEATURES;
export function features(sport: "tennis"): typeof TENNIS_FEATURES;
export function features(sport: "volleyball"): typeof VOLLEYBALL_FEATURES;
export function features(sport: Sport): readonly string[];
export function features(sport: Sport): readonly string[] {
  return discovery(sport).features;
}

/** Values accepted for `SurfaceOptions.displayRange`. */
export function displayRanges(sport: "baseball"): typeof BASEBALL_DISPLAY_RANGES;
export function displayRanges(sport: "basketball"): typeof BASKETBALL_DISPLAY_RANGES;
export function displayRanges(sport: "curling"): typeof CURLING_DISPLAY_RANGES;
export function displayRanges(sport: "football"): typeof FOOTBALL_DISPLAY_RANGES;
export function displayRanges(sport: "hockey"): typeof HOCKEY_DISPLAY_RANGES;
export function displayRanges(sport: "lacrosse"): typeof LACROSSE_DISPLAY_RANGES;
export function displayRanges(sport: "soccer"): typeof SOCCER_DISPLAY_RANGES;
export function displayRanges(sport: "tennis"): typeof TENNIS_DISPLAY_RANGES;
export function displayRanges(sport: "volleyball"): typeof VOLLEYBALL_DISPLAY_RANGES;
export function displayRanges(sport: Sport): readonly string[];
export function displayRanges(sport: Sport): readonly string[] {
  return discovery(sport).displayRanges;
}

/** Keys accepted by `SurfaceOptions.colorUpdates`. */
export function colorKeys(sport: "baseball"): typeof BASEBALL_COLOR_KEYS;
export function colorKeys(sport: "basketball"): typeof BASKETBALL_COLOR_KEYS;
export function colorKeys(sport: "curling"): typeof CURLING_COLOR_KEYS;
export function colorKeys(sport: "football"): typeof FOOTBALL_COLOR_KEYS;
export function colorKeys(sport: "hockey"): typeof HOCKEY_COLOR_KEYS;
export function colorKeys(sport: "lacrosse"): typeof LACROSSE_COLOR_KEYS;
export function colorKeys(sport: "soccer"): typeof SOCCER_COLOR_KEYS;
export function colorKeys(sport: "tennis"): typeof TENNIS_COLOR_KEYS;
export function colorKeys(sport: "volleyball"): typeof VOLLEYBALL_COLOR_KEYS;
export function colorKeys(sport: Sport): readonly string[];
export function colorKeys(sport: Sport): readonly string[] {
  return discovery(sport).colorKeys;
}
