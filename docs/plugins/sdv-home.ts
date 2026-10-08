import { readFileSync } from "node:fs";
import type { LoadContext, Plugin } from "@docusaurus/types";
import { abs } from "../../examples/sources";

/** One sdvplot league: how many of its teams have each resource. */
export interface LeagueCoverage {
  readonly league: string;
  readonly teams: number;
  /** Teams with a primary colour. */
  readonly colors: number;
  /** Teams with at least one logo / wordmark in the archive manifest. */
  readonly logos: number;
  readonly wordmarks: number;
  /** Alias rows (ids, abbreviations, names, by season) that resolve to the league's teams, and their id systems. */
  readonly aliases: number;
  readonly idSystems: number;
  /** Player-id systems with headshots: "espn" (headshotUrl), "gsis" (nfl only), "league" (the league CDN helpers). */
  readonly headshots: readonly string[];
}
export interface Coverage {
  readonly indexVersion: string;
  readonly manifestDate: string;
  readonly archiveHost: string;
  readonly leagues: readonly LeagueCoverage[];
  readonly sports: readonly { readonly sport: string; readonly leagues: readonly string[] }[];
  /** Teams per `color_source` and marks per `source`, across every league. */
  readonly colorSources: Readonly<Record<string, number>>;
  readonly markSources: Readonly<Record<string, number>>;
}

/** What this plugin reads of sdvplot's index (packages/sdvplot/src/data/index.ts) and headshots module. */
interface SdvplotData {
  LEAGUES: readonly string[];
  INDEX_VERSION: string;
  MANIFEST_LAST_MODIFIED: string;
  ARCHIVE_BASE: string;
  loaders: Readonly<
    Record<
      string,
      () => Promise<{
        teams: readonly { color_primary: string | null; color_source: string | null }[];
        aliases: readonly { id_system: string }[];
        marks: readonly { team_id: string; mark_type: string; source: string }[];
      }>
    >
  >;
}
interface SdvplotHeadshots {
  ESPN_HEADSHOT_LEAGUES: Readonly<Record<string, string>>;
  nbaHeadshotUrl: unknown;
  wnbaHeadshotUrl: unknown;
  mlbHeadshotUrl: unknown;
  nhlHeadshotUrl: unknown;
}
interface Sporty {
  SPORTS: readonly string[];
  leagues: (sport: string) => readonly string[];
}

/**
 * Reads the packages' own registries: the sdvplot index shards and sporty's `SPORTS` / `leagues()`.
 * Imported by path at run time, not statically, so the docs' tsc stays out of the package sources (sdvplot's
 * ~20 MB of data shards); the docs build and examples/test/home-coverage.test.tsx run it against the real modules.
 */
export async function coverage(): Promise<Coverage> {
  const load = <T>(p: string): Promise<T> => import(/* webpackIgnore: true */ abs(p)) as Promise<T>;
  const [data, shots, sporty] = await Promise.all([
    load<SdvplotData>("packages/sdvplot/src/data/index.ts"),
    load<SdvplotHeadshots>("packages/sdvplot/src/headshots.ts"),
    load<Sporty>("packages/sporty/src/api.ts"),
  ]);
  // The league-id CDN builders sdvplot exports (looked up by name, so a rename fails the build, not the page).
  const cdn = {
    nba: "nbaHeadshotUrl",
    wnba: "wnbaHeadshotUrl",
    mlb: "mlbHeadshotUrl",
    nhl: "nhlHeadshotUrl",
  } as const;
  for (const fn of Object.values(cdn))
    if (typeof shots[fn] !== "function") throw new Error(`sdv-coverage: sdvplot no longer exports ${fn}`);
  const colorSources: Record<string, number> = {};
  const markSources: Record<string, number> = {};
  const count = (into: Record<string, number>, k: string | null): void => {
    if (k !== null) into[k] = (into[k] ?? 0) + 1;
  };
  const leagues: LeagueCoverage[] = [];
  for (const league of data.LEAGUES) {
    const loader = data.loaders[league];
    if (!loader) throw new Error(`sdv-coverage: no loader for league ${league}`);
    const d = await loader();
    for (const t of d.teams) count(colorSources, t.color_source);
    for (const m of d.marks) count(markSources, m.source);
    const withMark = (type: string): number =>
      new Set(d.marks.filter((m) => m.mark_type === type).map((m) => m.team_id)).size;
    leagues.push({
      league,
      teams: d.teams.length,
      colors: d.teams.filter((t) => t.color_primary !== null).length,
      logos: withMark("logo"),
      wordmarks: withMark("wordmark"),
      aliases: d.aliases.length,
      idSystems: new Set(d.aliases.map((a) => a.id_system)).size,
      headshots: [
        ...(Object.hasOwn(shots.ESPN_HEADSHOT_LEAGUES, league) ? ["espn"] : []),
        // gsis ids are nfl-only: headshotUrl rejects { idSystem: "gsis" } for any other league
        ...(league === "nfl" ? ["gsis"] : []),
        ...(Object.hasOwn(cdn, league) ? ["league"] : []),
      ],
    });
  }
  return {
    indexVersion: data.INDEX_VERSION,
    manifestDate: data.MANIFEST_LAST_MODIFIED,
    archiveHost: new URL(data.ARCHIVE_BASE).host,
    leagues,
    sports: sporty.SPORTS.map((sport) => ({ sport, leagues: [...sporty.leagues(sport)] })),
    colorSources,
    markSources,
  };
}

/** A badge of the README's row: `[![alt](src)](href)`. */
export interface Badge {
  readonly alt: string;
  readonly src: string;
  readonly href: string;
}
/** The root README's badge row (between its `badges: start` / `end` comments), so the site shows the same set. */
export function readmeBadges(readme: string = readFileSync(abs("README.md"), "utf8")): Badge[] {
  const block = /<!-- badges: start -->([\s\S]*?)<!-- badges: end -->/.exec(readme)?.[1] ?? "";
  const badges = [...block.matchAll(/\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)/g)].map(
    ([, alt = "", src = "", href = ""]) => ({
      alt,
      src,
      href,
    }),
  );
  if (badges.length === 0)
    throw new Error("sdv-home: README.md has no badges between <!-- badges: start/end -->");
  return badges;
}

/** What the home page reads with `usePluginData("sdv-home")`. */
export interface HomeData {
  readonly coverage: Coverage;
  readonly badges: readonly Badge[];
}

/**
 * The home page's data, computed at build time and never typed by hand: the "What's covered" tables from the
 * packages' registries, and the README's badge row. Handed to the page as this plugin's global data.
 * ponytail: global data ships with every page (~1 KB brotli); move it to createData + a route prop if it grows.
 */
export default function sdvHome(_context: LoadContext): Plugin {
  return {
    name: "sdv-home",
    loadContent: async (): Promise<HomeData> => ({ coverage: await coverage(), badges: readmeBadges() }),
    async contentLoaded({ content, actions }) {
      actions.setGlobalData(content);
    },
  };
}
