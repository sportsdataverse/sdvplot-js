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
  "yahoo", // Yahoo's dotted ids ("ncaaf.t.1", "nba.t.1") are no other system's
  "kenpom", // KenPom and Torvik team names (mbb; Torvik wbb too): the providers' own spellings, before "name"
  "torvik",
  "sdvplotr",
  "name",
] as const;
/**
 * Systems "auto" never tries, only an explicit `idSystem`: their numbers are other teams' ESPN ids. NHL stats API
 * ids 1-28; Fox, CBS, 247Sports (team and institution ids) and On3 (org ids): Fox 25 is Ohio State, ESPN 25 California.
 */
export const EXPLICIT_ONLY = ["nhl_id", "fox", "cbs", "sports247", "on3"] as const;
export type IdSystem = "auto" | (typeof PRIORITY)[number] | (typeof EXPLICIT_ONLY)[number];
export type MarkType = "logo" | "wordmark";
export type Which = "primary" | "secondary";
/** "default" and "dark" always exist; other archive variant names are accepted and checked at runtime. */
export type Variant = "default" | "dark" | (string & {});
export type SeasonInput = number | string | null | undefined;
export type HeadshotIdSystem = "espn" | "gsis";
