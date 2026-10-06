import { InputError, warn } from "./errors.js";
import { getLeagueSync } from "./index-data.js";
import { checkAlpha, checkHeight } from "./placement.js";
import { type Value, resolveSync } from "./resolve.js";
import type { League, TeamId, Variant } from "./types.js";

export const TIER_DESC: Readonly<Record<number, string>> = {
  1: "Elite",
  2: "Very Good",
  3: "Medium",
  4: "Bad",
  5: "What are they doing?",
  6: "",
  7: "",
};
export const TIERS_SUBTITLE = "created with the #sdvplot Tiermaker";
export const TIER_THEMES = {
  dark: { bg: "#1e1e1e", line: "#e0e0e0", text: "#ffffff", muted: "#8e8e93" },
  light: { bg: "#ffffff", line: "#3a3a3c", text: "#1e1e1e", muted: "#636366" },
} as const;
const AUTO_VARIANT = { dark: "dark", light: "default" } as const;
// ponytail: DEFAULT_HEIGHT is the Python one (a fraction of panel height for 32 logos in 5 tiers).
const DEFAULT_HEIGHT = 0.1;

export interface TierRow {
  tierNo?: Value;
  tier_no?: Value;
  team: Value;
  tierRank?: Value;
  tier_rank?: Value;
}
export interface TiersOptions {
  /** `undefined` gives the league name plus "Team Tiers"; `null` or an empty string gives no title. */
  title?: string | null;
  /** `undefined` gives the Tiermaker line; `null` or an empty string gives none. */
  subtitle?: string | null;
  caption?: string | null;
  tierDesc?: Readonly<Record<number, string>>;
  presort?: boolean;
  alpha?: number;
  /** Fraction of the plot height in (0, 1]; default 0.1. */
  height?: number;
  noLineBelowTier?: number | readonly number[];
  theme?: "dark" | "light";
  variant?: Variant | "auto";
}
export interface Tiers {
  x: number[];
  y: number[];
  teamIds: TeamId[];
  labels: string[];
  lines: number[];
  breaks: number[];
  breakLabels: string[];
  xlim: [number, number];
  ylim: [number, number];
  title: string;
  subtitle: string | null;
  caption: string | null;
  height: number;
  alpha: number;
  variant: Variant;
  theme: (typeof TIER_THEMES)[keyof typeof TIER_THEMES];
}

/** `textwrap.wrap(text, 14, break_long_words=False, break_on_hyphens=False)` joined by newlines: lines of at most 14 characters, a longer word kept whole on its own line. */
export function wrapLabel(text: string): string {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + w.length > 14) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out.join("\n");
}

const miss = (v: Value): boolean =>
  v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));
const real = (v: Value): boolean => (typeof v === "number" && !Number.isNaN(v)) || typeof v === "bigint";

/** Port of `sdvplot._tiers.prepare`: validate the rows and compute everything a tier plot draws. */
export function prepareTiers(rows: readonly TierRow[], league: League, o: TiersOptions = {}): Tiers {
  const theme = o.theme ?? "dark";
  if (!Object.hasOwn(TIER_THEMES, theme))
    throw new InputError(`theme must be "dark" or "light", got ${String(theme)}`);
  const height = o.height === undefined ? DEFAULT_HEIGHT : checkHeight(o.height);
  const alpha = checkAlpha(o.alpha ?? 0.8);
  const tiers = rows.map((r): Value => r.tierNo ?? r.tier_no);
  const teams = rows.map((r) => r.team);
  const ranksIn = rows.map((r): Value => r.tierRank ?? r.tier_rank);
  const given = !o.presort && ranksIn.some((v) => v !== undefined) ? ranksIn : undefined;

  const all = rows.map((_, i) => i);
  const absent = all.filter((i) => miss(tiers[i]) || (given !== undefined && miss(given[i])));
  if (absent.length) {
    const names = absent.map((i) => String(teams[i]));
    const extra = names.length > 10 ? ` and ${names.length - 10} more` : "";
    const shown = `${names.slice(0, 10).join(", ")}${extra}`;
    warn(
      `tiers:${league}:missing:${shown}`,
      `skipped ${names.length} point(s) with a missing tier_no or tier_rank: ${shown}`,
    );
  }
  let idx = all.filter((i) => !absent.includes(i));
  if (!idx.length) throw new InputError("data has no rows with a tier_no");
  if (!idx.every((i) => real(tiers[i]) && (given === undefined || real(given[i]))))
    throw new InputError("tier_no and tier_rank must hold numbers (tier 1 is the top tier)");
  const tierOf = (i: number): number => Number(tiers[i]);
  if (o.presort) {
    // arrange(tier_no, team), then rank within the tier; a missing team last, as R's NA
    const name = (i: number): string => String(teams[i]);
    const cp = (i: number): number[] => Array.from(name(i), (c) => c.codePointAt(0) as number);
    const cmp = (a: number[], b: number[]): number => {
      for (let k = 0; k < Math.min(a.length, b.length); k++)
        if (a[k] !== b[k]) return (a[k] as number) - (b[k] as number);
      return a.length - b.length;
    };
    idx = idx.sort(
      (a, b) => tierOf(a) - tierOf(b) || Number(miss(teams[a])) - Number(miss(teams[b])) || cmp(cp(a), cp(b)),
    );
  }
  const ranks = new Map<number, number>();
  const seen = new Map<number, number>();
  for (const i of idx) {
    if (given) ranks.set(i, Number(given[i]));
    else {
      const t = tierOf(i);
      const n = (seen.get(t) ?? 0) + 1;
      seen.set(t, n);
      ranks.set(i, n);
    }
  }

  // Rank first, then resolve: an unknown team keeps its slot (and the x range) but draws nothing.
  const ids = resolveSync(
    idx.map((i) => teams[i]),
    league,
  );
  const kept = idx.flatMap((i, k) => {
    const id = ids[k];
    return id === undefined ? [] : [[i, id] as const];
  });
  const abbr = new Map(getLeagueSync(league).teams.map((t) => [t.team_id, t.abbr]));
  const levels = [...new Set(idx.map(tierOf))].sort((a, b) => a - b);
  const skip = new Set<number>(
    o.noLineBelowTier === undefined
      ? []
      : typeof o.noLineBelowTier === "number"
        ? [o.noLineBelowTier]
        : o.noLineBelowTier,
  );
  const desc = o.tierDesc ?? TIER_DESC;
  const rs = [...ranks.values()];
  const lo = Math.min(...rs);
  const hi = Math.max(...rs);
  const pad = lo === hi ? 0.5 : 0.05 * (hi - lo);
  const first = levels[0] as number;
  const last = levels[levels.length - 1] as number;
  return {
    x: kept.map(([i]) => ranks.get(i) as number),
    y: kept.map(([i]) => tierOf(i)),
    teamIds: kept.map(([, id]) => id),
    labels: kept.map(([i, id]) => abbr.get(id) || String(teams[i])),
    lines: [first - 0.5, ...levels.filter((t) => !skip.has(t)).map((t) => t + 0.5)],
    breaks: levels,
    breakLabels: levels.map((t) => wrapLabel(desc[t] ?? "")),
    xlim: [lo - pad, hi + pad],
    ylim: [first - 0.6, last + 0.6],
    title: o.title === undefined ? `${league.toUpperCase()} Team Tiers` : (o.title ?? ""),
    subtitle: o.subtitle === undefined ? TIERS_SUBTITLE : o.subtitle,
    caption: o.caption ?? null,
    height,
    alpha,
    variant: (o.variant ?? "auto") === "auto" ? AUTO_VARIANT[theme] : (o.variant as Variant),
    theme: TIER_THEMES[theme],
  };
}
