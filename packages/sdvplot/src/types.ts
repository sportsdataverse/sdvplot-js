export type { League } from "./data/index.js";

declare const brand: unique symbol;
/** A canonical SDV team id. Only `resolve()` makes one; a raw abbreviation is a `string`, not a `TeamId`. */
export type TeamId = string & { readonly [brand]: "TeamId" };
export const asTeamId = (s: string): TeamId => s as TeamId;

export const PRIORITY = [
  "team_id",
  "espn",
  "espn_abbr",
  "nhl",
  "nflverse",
  "mlbstats",
  "nba_api",
  "hockeytech",
  "ncaa",
  "pff",
  "cricinfo",
  "cfbd",
  "bref",
  "sportsipy",
  "fangraphs",
  "sdvplotr",
  "name",
] as const;
export const EXPLICIT_ONLY = ["nhl_id"] as const;
export type IdSystem = "auto" | (typeof PRIORITY)[number] | (typeof EXPLICIT_ONLY)[number];
export type MarkType = "logo" | "wordmark";
export type Which = "primary" | "secondary";
/** "default" and "dark" always exist; other archive variant names are accepted and checked at runtime. */
export type Variant = "default" | "dark" | (string & {});
export type SeasonInput = number | string | null | undefined;
export type HeadshotIdSystem = "espn" | "gsis";
