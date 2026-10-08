import { contrast, hex6 } from "./contrast.js";
import { getLeagueSync, loadLeague } from "./index-data.js";
import { type ResolveOptions, type Value, resolveSync } from "./resolve.js";
import type { League } from "./types.js";

// Port of Game on Paper's game colours (`pickGameColors`, astro/src/utils/misc.ts at b8b8eaad): its Lab
// conversion, candidate order, thresholds and fallbacks, kept operation for operation so the pairs match
// its output exactly (fixtures/matchup-colors).

const MIN_DELTA_E = 20;
const MIN_CONTRAST = 2.5;
/** Game on Paper's page backgrounds (`GAME_BACKGROUNDS`). */
const BACKGROUNDS = { light: "#ffffff", dark: "#181a1b" } as const;
/** A team with no colour gets Game on Paper's `STANDARD_THEME_COLOR`. */
const NO_COLOR = "#2394fd";

type Lab = [number, number, number];

/** CIE L*a*b* (D65) of `#rrggbb`: Game on Paper's `rgb2lab`, with its rounded constants. */
function lab(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const s = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return s > 0.04045 ? ((s + 0.055) / 1.055) ** 2.4 : s / 12.92;
  }) as Lab;
  const f = (t: number) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** `hex` with its L* set to `L` (a*, b* kept), clamped into sRGB: Game on Paper's `lab2rgb` + `rgbArrayToHex`. */
function withLightness(hex: string, L: number): string {
  const [, A, B] = lab(hex);
  const f = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const fy = (L + 16) / 116;
  const x = 0.95047 * f(A / 500 + fy);
  const y = f(fy);
  const z = 1.08883 * f(fy - B / 200);
  const lin = [
    x * 3.2406 + y * -1.5372 + z * -0.4986,
    x * -0.9689 + y * 1.8758 + z * 0.0415,
    x * 0.0557 + y * -0.204 + z * 1.057,
  ];
  return `#${lin
    .map((v) => {
      const s = v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : 12.92 * v;
      return Math.round(Math.max(0, Math.min(1, s)) * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

/** CIEDE2000 colour difference between two L*a*b* colours (Sharma, Wu and Dalal 2005). */
export function deltaE2000Lab([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const rad = Math.PI / 180;
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (ap: number, bp: number) => (ap === 0 && bp === 0 ? 0 : (Math.atan2(bp, ap) / rad + 360) % 360);
  const h1 = hue(a1p, b1);
  const h2 = hue(a2p, b2);
  const dL = L2 - L1;
  const dC = C2p - C1p;
  let dh = 0;
  if (C1p * C2p !== 0)
    dh = Math.abs(h2 - h1) <= 180 ? h2 - h1 : h2 - h1 > 180 ? h2 - h1 - 360 : h2 - h1 + 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh * rad) / 2);
  const Lm = (L1 + L2) / 2;
  const Cmp = (C1p + C2p) / 2;
  let Hm = h1 + h2;
  if (C1p * C2p !== 0)
    Hm = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
  const T =
    1 -
    0.17 * Math.cos((Hm - 30) * rad) +
    0.24 * Math.cos(2 * Hm * rad) +
    0.32 * Math.cos((3 * Hm + 6) * rad) -
    0.2 * Math.cos((4 * Hm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((Hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const Sc = 1 + 0.045 * Cmp;
  const Sh = 1 + 0.015 * Cmp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

/** CIEDE2000 between two `#rrggbb` colours, through Game on Paper's Lab conversion. */
export function deltaE2000(a: string, b: string): number {
  return deltaE2000Lab(lab(a), lab(b));
}

/** Game on Paper's `pickPairOn`: the first usable candidate, else L* moved until the pair reads and separates. */
function pickPair(candidates: [string, string][], background: string): [string, string] {
  const readable = (c: string) => contrast(c, background) >= MIN_CONTRAST;
  const apart = (x: string, y: string) => deltaE2000(x, y) >= MIN_DELTA_E;
  // the side with room to read: darker on a light background, lighter on a dark one
  const dir = lab(background)[0] >= 50 ? -1 : 1;
  // nearest L* at which the colour reads on this background
  const readableVariant = (c: string) => {
    if (readable(c)) return c;
    const L0 = lab(c)[0];
    for (let k = 1; k <= 100; k++) {
      const v = withLightness(c, L0 + dir * k);
      if (readable(v)) return v;
    }
    return c;
  };

  for (const [x, y] of candidates) if (readable(x) && readable(y) && apart(x, y)) return [x, y];
  const variants = candidates.map(([x, y]): [string, string] => [readableVariant(x), readableVariant(y)]);
  for (const [x, y] of variants) if (apart(x, y)) return [x, y];

  // move both colours' L* within the range where each still reads, least total movement first;
  // keep the widest readable separation seen in case nothing clears
  const [x, y] = variants[0] as [string, string];
  const readableShifts = (c: string) => {
    const L0 = lab(c)[0];
    const byShift: string[][] = []; // byShift[|k|] = readable variants moved |k| in L*
    for (let k = -100; k <= 100; k++) {
      if (L0 + k < 0 || L0 + k > 100) continue;
      const v = k === 0 ? c : withLightness(c, L0 + k);
      if (!readable(v)) continue;
      byShift[Math.abs(k)] ??= [];
      byShift[Math.abs(k)]?.push(v);
    }
    return byShift;
  };
  const xs = readableShifts(x);
  const ys = readableShifts(y);
  let best: [string, string] = [x, y];
  let bestDE = deltaE2000(x, y);
  for (let total = 1; total <= 200; total++) {
    for (let i = 0; i <= total; i++) {
      for (const hx of xs[i] ?? [])
        for (const hy of ys[total - i] ?? []) {
          const d = deltaE2000(hx, hy);
          if (d >= MIN_DELTA_E) return [hx, hy];
          if (d > bestDE) {
            best = [hx, hy];
            bestDE = d;
          }
        }
    }
  }
  return best;
}

/** Options for {@link matchupColors}: the league, how to resolve the two teams, and the backgrounds. */
export interface MatchupColorOptions extends ResolveOptions {
  /** The league both teams belong to. */
  league: League;
  /** The background each theme's pair must read on; default `{ light: "#ffffff", dark: "#181a1b" }` (Game on Paper's pages). */
  theme?: { light?: string; dark?: string };
}
/** One `[teamA, teamB]` colour pair per theme, as lowercase `#rrggbb`. */
export interface MatchupColors {
  /** The pair for a light background. */
  light: [string, string];
  /** The pair for a dark background. */
  dark: [string, string];
}

/**
 * {@link matchupColors} once the league is loaded (`loadLeague` or `preloadAll`).
 *
 * @example
 * ```ts
 * import { loadLeague, matchupColorsSync } from "@sportsdataverse/sdvplot";
 *
 * await loadLeague("cfb");
 * matchupColorsSync("Alabama", "Georgia", { league: "cfb" });
 * ```
 */
export function matchupColorsSync(teamA: Value, teamB: Value, opts: MatchupColorOptions): MatchupColors {
  const { league, theme, ...resolveOpts } = opts;
  const bg = { light: hex6(theme?.light ?? BACKGROUNDS.light), dark: hex6(theme?.dark ?? BACKGROUNDS.dark) };
  const ids = resolveSync([teamA, teamB], league, resolveOpts);
  const rows = getLeagueSync(league).teams;
  const [a, b] = ids.map((id) => {
    const t = id === undefined ? undefined : rows.find((r) => r.team_id === id);
    const alt = t?.color_secondary ?? null;
    return { primary: t?.color_primary ?? alt ?? NO_COLOR, alt };
  }) as [{ primary: string; alt: string | null }, { primary: string; alt: string | null }];
  // both primaries, teamB's alternate, teamA's alternate, both alternates
  const candidates = [
    [a.primary, b.primary],
    [a.primary, b.alt],
    [a.alt, b.primary],
    [a.alt, b.alt],
  ].filter((p): p is [string, string] => p[0] !== null && p[1] !== null);
  return { light: pickPair(candidates, bg.light), dark: pickPair(candidates, bg.dark) };
}

/**
 * Two team colours that tell the teams apart on a chart: Game on Paper's "game colours" picker.
 *
 * @remarks
 * One pair per theme, each the first candidate whose colours are at least 20 apart in CIEDE2000 and each
 * at least 2.5:1 (WCAG) against that theme's background. Candidates, in order: both primaries, teamB's
 * secondary, teamA's secondary, both secondaries; so a team keeps its primary whenever it works, and teamA
 * (Game on Paper's home team) keeps it first. When no candidate works, an unreadable colour's L* moves just
 * far enough to read; then both colours' L* move, least total movement first, until they separate; failing
 * that, the widest readable separation found. A team with no colour gets `#2394fd`. Deterministic.
 *
 * @example
 * ```ts
 * import { matchupColors } from "@sportsdataverse/sdvplot";
 *
 * // two crimson teams; light: ["#9e1b32", "#2c2a29"] (Georgia's secondary), dark: ["#ffffff", "#ba0c2f"]
 * // in a page, pick the pair for the theme:
 * // const [alabama, georgia] = window.matchMedia("(prefers-color-scheme: dark)").matches ? dark : light;
 * await matchupColors("Alabama", "Georgia", { league: "cfb" });
 * ```
 */
export async function matchupColors(
  teamA: Value,
  teamB: Value,
  opts: MatchupColorOptions,
): Promise<MatchupColors> {
  await loadLeague(opts.league);
  return matchupColorsSync(teamA, teamB, opts);
}
