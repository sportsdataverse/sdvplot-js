// Plot-free: sporty CORE only. Internal (not in the core barrel: sporty is an optional peer); reached via ./plot and ./d3.
import {
  BASEBALL_SPECS,
  type BaseballColorKey,
  type BaseballDisplayRange,
  type BaseballParamUpdates,
  type BasketballColorKey,
  type BasketballDisplayRange,
  type BasketballParamUpdates,
  type CurlingColorKey,
  type CurlingDisplayRange,
  type CurlingParamUpdates,
  type FootballColorKey,
  type FootballDisplayRange,
  type FootballParamUpdates,
  type HockeyColorKey,
  type HockeyDisplayRange,
  type HockeyParamUpdates,
  type LacrosseColorKey,
  type LacrosseDisplayRange,
  type LacrosseParamUpdates,
  SOFTBALL_SPECS,
  type Scene,
  type SoccerColorKey,
  type SoccerDisplayRange,
  type SoccerParamUpdates,
  type SoftballColorKey,
  type SoftballDisplayRange,
  type SoftballParamUpdates,
  type Sport,
  type TennisColorKey,
  type TennisDisplayRange,
  type TennisParamUpdates,
  UnknownDisplayRangeError,
  type VolleyballColorKey,
  type VolleyballDisplayRange,
  type VolleyballParamUpdates,
  convertUnits,
  displayRanges,
  normalizeUnit,
  rotateCoords,
  surface as sportySurface,
} from "@sportsdataverse/sporty";
import { teamColorPairSync } from "./colors.js";
import { contrast, onColor } from "./contrast.js";
import { LEAGUES } from "./data/index.js";
import { InputError } from "./errors.js";
import type { Value } from "./resolve.js";
import type { League, SeasonInput } from "./types.js";

export type SurfaceSport = Sport;
/**
 * Maps an sdv surface key to `[sporty sport, sporty league key]`: the SDV surface-key table shared with sdvplot (Python
 * `SURFACES`) and sdvplotR (`surface_map`). Keys that are also sdv team leagues (`nfl`, `ncaa_softball`, ...) take a `team`;
 * the rest (`atp`, `fiba`, `nll`, ...) draw the plain surface.
 */
export const SURFACES: Readonly<Record<string, readonly [SurfaceSport, string]>> = {
  nfl: ["football", "nfl"],
  aaf: ["football", "nfl"],
  ufl: ["football", "nfl"],
  usfl: ["football", "nfl"],
  xfl: ["football", "nfl"],
  cfb: ["football", "ncaa"],
  cfl: ["football", "cfl"],
  nfhs_football: ["football", "nfhs11"],
  nba: ["basketball", "nba"],
  nbagl: ["basketball", "nba g league"],
  wnba: ["basketball", "wnba"],
  mbb: ["basketball", "ncaa"],
  wbb: ["basketball", "ncaa"],
  fiba: ["basketball", "fiba"],
  nfhs_basketball: ["basketball", "nfhs"],
  mlb: ["baseball", "mlb"],
  milb: ["baseball", "milb"],
  ncaa_baseball: ["baseball", "ncaa"],
  little_league: ["baseball", "little league"],
  pony: ["baseball", "pony"],
  nfhs_baseball: ["baseball", "nfhs"],
  ncaa_softball: ["softball", "ncaa"],
  nhl: ["hockey", "nhl"],
  whl: ["hockey", "nhl"],
  pwhl: ["hockey", "pwhl"],
  ahl: ["hockey", "ahl"],
  echl: ["hockey", "echl"],
  ohl: ["hockey", "ohl"],
  qmjhl: ["hockey", "qmjhl"],
  ushl: ["hockey", "ushl"],
  phf: ["hockey", "phf"],
  iihf: ["hockey", "iihf"],
  nwhl: ["hockey", "nwhl"],
  ncaa_mhockey: ["hockey", "ncaa"],
  ncaa_whockey: ["hockey", "ncaa"],
  soccer: ["soccer", "fifa"], // drawn 105 x 68 m (see SOCCER_PITCH)
  fifa: ["soccer", "fifa"],
  epl: ["soccer", "epl"],
  mls: ["soccer", "mls"],
  nwsl: ["soccer", "nwsl"],
  ncaa_soccer: ["soccer", "ncaa"],
  nll: ["lacrosse", "nll"],
  pll: ["lacrosse", "pll"],
  world_lacrosse: ["lacrosse", "world lacrosse"],
  ncaa_mlacrosse: ["lacrosse", "ncaam"],
  ncaa_wlacrosse: ["lacrosse", "ncaaw"],
  usa_mlacrosse: ["lacrosse", "usam"],
  usa_wlacrosse: ["lacrosse", "usaw"],
  atp: ["tennis", "atp"],
  wta: ["tennis", "wta"],
  itf: ["tennis", "itf"],
  ita: ["tennis", "ita"],
  usta: ["tennis", "usta"],
  ncaa_tennis: ["tennis", "ncaa"],
  fivb: ["volleyball", "fivb"],
  usa_volleyball: ["volleyball", "usa volleyball"],
  ncaa_volleyball: ["volleyball", "ncaa"],
  wcf: ["curling", "wcf"],
  curling_canada: ["curling", "curling canada"],
};
/** sportyR's regulation surface colours (sdvplotR's `surface_base`, sdvplot's `SURFACE_BASE`): court wood, grass, ice. */
export const SURFACE_BASE = {
  basketball: "#d2ab6f",
  football: "#196f0c",
  hockey: "#ffffff",
  soccer: "#196f0c",
  baseball: "#395d33",
  softball: "#395d33",
} as const;
/** A diamond's centre logo is this fraction of the centre-field distance across (sdvplotR's `field_logo_fraction`). */
const FIELD_LOGO_FRACTION = 0.15;
/** sportyR's "fifa" pitch is FIFA's 120 x 90 m maximum; the `soccer` key draws a real 105 x 68 m pitch, as sdvplot and sdvplotR do. */
const SOCCER_PITCH = { pitch_length: 105, pitch_width: 68 } as const;

type Paint<K extends string> = Partial<Record<K, string>>;
type AnyColorKey =
  | BaseballColorKey
  | BasketballColorKey
  | CurlingColorKey
  | FootballColorKey
  | HockeyColorKey
  | LacrosseColorKey
  | SoccerColorKey
  | SoftballColorKey
  | TennisColorKey
  | VolleyballColorKey;
/**
 * Port of `_surface.color_updates`: the team colours a sport's surface takes, keyed by sporty colour key. Sports without a
 * team painting (baseball, softball, soccer and the team-less surfaces) take none, as in sdvplotR.
 */
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
  if (sport !== "hockey") return {};
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

type AnyRange =
  | BaseballDisplayRange
  | BasketballDisplayRange
  | CurlingDisplayRange
  | FootballDisplayRange
  | HockeyDisplayRange
  | LacrosseDisplayRange
  | SoccerDisplayRange
  | SoftballDisplayRange
  | TennisDisplayRange
  | VolleyballDisplayRange;
export interface SurfaceSceneOptions {
  /** A team of the league, painting the surface; only for keys that are sdv team leagues (otherwise `InputError`). */
  team?: Value;
  season?: SeasonInput;
  /** Overrides on top of the team painting, keyed by sporty colour key. */
  colorUpdates?: Paint<AnyColorKey>;
  rotation?: number;
  /** A sporty display range for the league's sport; one the sport does not know throws sporty's UnknownDisplayRangeError. */
  displayRange?: AnyRange;
  xlim?: readonly [number, number];
  ylim?: readonly [number, number];
  units?: "ft" | "m" | "yd" | "in" | "cm" | "mm";
  /** Sporty parameter overrides (intersected across sports so each sport's own keys type-check). */
  updates?: BaseballParamUpdates &
    BasketballParamUpdates &
    CurlingParamUpdates &
    FootballParamUpdates &
    HockeyParamUpdates &
    LacrosseParamUpdates &
    SoccerParamUpdates &
    SoftballParamUpdates &
    TennisParamUpdates &
    VolleyballParamUpdates;
  arcResolution?: number;
  xTrans?: number;
  yTrans?: number;
}

const isTeamLeague = (v: string): v is League => (LEAGUES as readonly string[]).includes(v);

/**
 * Build the sporty scene for an sdv surface key, painted in `team`'s colours. The league check and a `team` on a key
 * without team identities throw `InputError`; sporty's own errors (unknown displayRange/unit, bad arcResolution) escape
 * unwrapped.
 */
export function surfaceScene(league: League | (string & {}), o: SurfaceSceneOptions = {}): Scene {
  // own keys only: an inherited name ("constructor", "__proto__") must take the InputError path, not a TypeError
  const entry = Object.hasOwn(SURFACES, league) ? SURFACES[league] : undefined;
  if (!entry)
    throw new InputError(
      `no surface for league '${league}'; supported: ${Object.keys(SURFACES).sort().join(", ")}`,
    );
  const [sport, key] = entry;
  const { team, season, colorUpdates: user, displayRange, updates, ...rest } = o;
  let paint: Record<string, string> = {};
  if (team !== undefined && team !== null) {
    if (!isTeamLeague(league))
      throw new InputError(`no team identities for '${league}': draw the plain surface without a team`);
    const at = season !== undefined ? { season } : {};
    const { primary, secondary } = teamColorPairSync(league, team, at);
    if (primary !== undefined) paint = colorUpdates(sport, primary, secondary);
  }
  const ranges = displayRanges(sport);
  if (displayRange !== undefined && !(ranges as readonly string[]).includes(displayRange))
    throw new UnknownDisplayRangeError(
      `unknown displayRange '${displayRange}'; expected one of: ${ranges.join(", ")}`,
    );
  const merged = league === "soccer" ? { ...SOCCER_PITCH, ...updates } : updates;
  // ponytail: one generic call; the per-sport option types are SurfaceSceneOptions' unions, checked above at runtime
  return sportySurface(sport, key, {
    ...rest,
    colorUpdates: { ...paint, ...user },
    ...(displayRange === undefined ? {} : { displayRange }),
    ...(merged === undefined ? {} : { updates: merged }),
  } as never);
}

/**
 * Where a team's centre logo goes on an sdv surface key: sdvplotR's `surface_logo_layer` (sdvplot's `_logo_box`).
 * The surface centre, except on a baseball or softball field, whose origin is home plate: there the logo goes in shallow
 * centre field, at x = 0 midway between second base (`baseline_distance * sqrt(2)`) and the centre-field fence, with
 * `size` 0.15 x `center_field_distance` across, from the league's spec, `updates` and `units`. As sporty draws the
 * surface, the point is translated by `xTrans` / `yTrans` and then rotated about the origin. `variant` is "dark" where
 * white reads better than black on the sport's regulation surface (`SURFACE_BASE`: grass), as in sdvplotR.
 * Internal: `league` must be a key of `SURFACES` (callers build the scene first, which checks it).
 */
export function centerLogoPlacement(
  league: string,
  o: SurfaceSceneOptions = {},
): { x: number; y: number; size?: number; variant: "dark" | "default" } {
  const [sport, key] = SURFACES[league] as readonly [SurfaceSport, string];
  let offset = 0;
  let size: number | undefined;
  if (sport === "baseball" || sport === "softball") {
    const specs: Readonly<
      Record<string, { baseline_distance: number; center_field_distance: number; field_units: string }>
    > = sport === "baseball" ? BASEBALL_SPECS : SOFTBALL_SPECS;
    const spec = specs[key] as (typeof specs)[string];
    const u = o.updates ?? {};
    const bl = u.baseline_distance ?? spec.baseline_distance;
    const cf = u.center_field_distance ?? spec.center_field_distance;
    const from = normalizeUnit((u.field_units ?? spec.field_units) || "ft");
    const to = normalizeUnit(o.units ?? from);
    offset = convertUnits((bl * Math.SQRT2 + cf) / 2, from, to);
    size = convertUnits(FIELD_LOGO_FRACTION * cf, from, to);
  }
  const [[x, y]] = rotateCoords([[o.xTrans ?? 0, offset + (o.yTrans ?? 0)]], o.rotation ?? 0) as [
    [number, number],
  ];
  const base = (SURFACE_BASE as Readonly<Record<string, string>>)[sport];
  const variant = base !== undefined && onColor(base) === "#ffffff" ? "dark" : "default";
  return { x, y, ...(size === undefined ? {} : { size }), variant };
}
