// Plot-free: sporty CORE only. Internal (not in the core barrel: sporty is an optional peer); reached via ./plot and ./d3.
import {
  BASKETBALL_DISPLAY_RANGES,
  type BasketballColorKey,
  type BasketballParamUpdates,
  FOOTBALL_DISPLAY_RANGES,
  type FootballColorKey,
  type FootballParamUpdates,
  HOCKEY_DISPLAY_RANGES,
  type HockeyColorKey,
  type HockeyParamUpdates,
  type Scene,
  UnknownDisplayRangeError,
  surface as sportySurface,
} from "@sportsdataverse/sporty";
import type {
  BasketballDisplayRange,
  FootballDisplayRange,
  HockeyDisplayRange,
} from "@sportsdataverse/sporty";
import { teamColorsSync } from "./colors.js";
import { contrast, onColor } from "./contrast.js";
import { InputError } from "./errors.js";
import type { Value } from "./resolve.js";
import type { League, SeasonInput } from "./types.js";

export type SurfaceSport = "basketball" | "football" | "hockey";
/** sdv league -> [sporty sport, sporty league key]. Baseball and soccer surfaces arrive in Phase 6; Python's team-less `fiba` is omitted (not an sdv League). */
export const SURFACES: Readonly<Record<string, readonly [SurfaceSport, string]>> = {
  nfl: ["football", "nfl"],
  aaf: ["football", "nfl"],
  ufl: ["football", "nfl"],
  usfl: ["football", "nfl"],
  xfl: ["football", "nfl"],
  cfb: ["football", "ncaa"],
  nba: ["basketball", "nba"],
  nbagl: ["basketball", "nba g league"],
  wnba: ["basketball", "wnba"],
  mbb: ["basketball", "ncaa"],
  wbb: ["basketball", "ncaa"],
  nhl: ["hockey", "nhl"],
  whl: ["hockey", "nhl"],
  pwhl: ["hockey", "pwhl"], // divergence: Python maps pwhl to NHLRink (sportypy has no PWHL rink); sporty ships a pwhl spec
  ahl: ["hockey", "ahl"],
  echl: ["hockey", "echl"],
  ohl: ["hockey", "ohl"],
  qmjhl: ["hockey", "qmjhl"],
  ushl: ["hockey", "ushl"],
  phf: ["hockey", "phf"],
  ncaa_mhockey: ["hockey", "ncaa"],
  ncaa_whockey: ["hockey", "ncaa"],
};
export const SURFACE_BASE = { basketball: "#d2ab6f", football: "#196f0c", hockey: "#ffffff" } as const;

type Paint<K extends string> = Partial<Record<K, string>>;
/** Port of `_surface.color_updates`: the team colours a sport's surface takes, keyed by sporty colour key. */
export function colorUpdates(
  sport: "basketball",
  primary: string,
  secondary?: string,
): Paint<BasketballColorKey>;
export function colorUpdates(sport: "football", primary: string, secondary?: string): Paint<FootballColorKey>;
export function colorUpdates(sport: "hockey", primary: string, secondary?: string): Paint<HockeyColorKey>;
export function colorUpdates(
  sport: SurfaceSport,
  primary: string,
  secondary?: string,
): Record<string, string>;
export function colorUpdates(
  sport: SurfaceSport,
  primary: string,
  secondary?: string,
): Record<string, string> {
  if (sport === "basketball") {
    const ink = onColor(primary);
    return {
      painted_area: primary,
      court_apron: primary,
      restricted_arc: ink,
      free_throw_circle_dash: ink,
      baseline_lower_defensive_box: ink,
      lane_lower_defensive_box: ink,
    } satisfies Paint<BasketballColorKey>;
  }
  if (sport === "football")
    return { offensive_endzone: primary, defensive_endzone: primary } satisfies Paint<FootballColorKey>;
  const ice = SURFACE_BASE.hockey;
  const readable = secondary !== undefined && contrast(primary, ice) < 3 && contrast(secondary, ice) >= 3;
  const accent = readable ? secondary : primary;
  return {
    center_line: accent,
    center_faceoff_circle: accent,
    center_faceoff_spot: accent,
    boards: primary,
  } satisfies Paint<HockeyColorKey>;
}

type AnyRange = BasketballDisplayRange | FootballDisplayRange | HockeyDisplayRange;
export interface SurfaceSceneOptions {
  team?: Value;
  season?: SeasonInput;
  /** Overrides on top of the team painting, keyed by sporty colour key. */
  colorUpdates?: Paint<BasketballColorKey | FootballColorKey | HockeyColorKey>;
  rotation?: number;
  /** A sporty display range for the league's sport; one the sport does not know throws sporty's UnknownDisplayRangeError. */
  displayRange?: AnyRange;
  xlim?: readonly [number, number];
  ylim?: readonly [number, number];
  units?: "ft" | "m" | "yd" | "in" | "cm" | "mm";
  /** Sporty parameter overrides (intersected across sports so each sport's own keys type-check). */
  updates?: BasketballParamUpdates & FootballParamUpdates & HockeyParamUpdates;
  arcResolution?: number;
  xTrans?: number;
  yTrans?: number;
}

const isIn = <const L extends readonly string[]>(list: L, v: string): v is L[number] => list.includes(v);
function pickRange<const L extends readonly string[]>(
  list: L,
  v: AnyRange | undefined,
): L[number] | undefined {
  if (v === undefined || isIn(list, v)) return v;
  throw new UnknownDisplayRangeError(`unknown displayRange '${v}'; expected one of: ${list.join(", ")}`);
}

/**
 * Build the sporty scene for an sdv league, painted in `team`'s colours. Only the league check throws `InputError`;
 * sporty's own errors (unknown displayRange/unit, bad arcResolution) escape unwrapped.
 */
export function surfaceScene(league: League, o: SurfaceSceneOptions = {}): Scene {
  const entry = SURFACES[league];
  if (!entry)
    throw new InputError(
      `no surface for league '${league}'; supported: ${Object.keys(SURFACES).sort().join(", ")}`,
    );
  const [sport, key] = entry;
  const { team, season, colorUpdates: user, displayRange, ...rest } = o;
  let primary: string | undefined;
  let secondary: string | undefined;
  if (team !== undefined && team !== null) {
    const at = season !== undefined ? { season } : {};
    [primary] = teamColorsSync(league, [team], { which: "primary", ...at });
    [secondary] = teamColorsSync(league, [team], { which: "secondary", ...at });
  }
  const dr = <const L extends readonly string[]>(list: L) => {
    const v = pickRange(list, displayRange);
    return v === undefined ? {} : { displayRange: v };
  };
  if (sport === "basketball") {
    const paint = primary === undefined ? {} : colorUpdates("basketball", primary, secondary);
    return sportySurface("basketball", key, {
      ...rest,
      colorUpdates: { ...paint, ...user },
      ...dr(BASKETBALL_DISPLAY_RANGES),
    });
  }
  if (sport === "football") {
    const paint = primary === undefined ? {} : colorUpdates("football", primary, secondary);
    return sportySurface("football", key, {
      ...rest,
      colorUpdates: { ...paint, ...user },
      ...dr(FOOTBALL_DISPLAY_RANGES),
    });
  }
  const paint = primary === undefined ? {} : colorUpdates("hockey", primary, secondary);
  return sportySurface("hockey", key, {
    ...rest,
    colorUpdates: { ...paint, ...user },
    ...dr(HOCKEY_DISPLAY_RANGES),
  });
}
