/**
 * Team colours for a chart background: each colour readable against it (3:1, WCAG 1.4.11) and distinct from the teams
 * before it (CIE76 ΔE). Internal, shared by the chart adapters that take a `background`; it depends only on
 * `contrast.ts` and `errors.ts`.
 */
import { contrast, hex6, mix, onColor } from "./contrast.js";
import { warn } from "./errors.js";

/** WCAG 1.4.11 (non-text contrast): a graphical object needs 3:1 against what is next to it. */
export const MIN_CONTRAST = 3;
/**
 * The smallest CIE76 ΔE (Lab distance) two teams' colours may sit apart. ΔE 2.3 is a just-noticeable difference for
 * two large patches side by side; a chart compares thin lines and small marks a legend away from each other, which
 * needs several times that (at 10, New England's and Kansas City's reds ended 10.2 apart on black). 20 is the
 * largest value measured (2026-10-18) to leave every team distinct with no warning: thresholds 10 to 20 on the full
 * NBA (30), NFL (32), MLB (30) and NHL (32) in league order, on #181a1b, #000000 and #ffffff, all gave zero warnings
 * with this search, and 20 is the cap set for it (test/team-palette.test.ts holds every one of those cells at 20).
 */
export const MIN_DELTA_E = 20;
/** The step, as a fraction of the way to the target colour, of the readable and lightness mixes. */
 * needs several times that. 10 keeps same-family colours apart (a navy from a royal blue, two golds a shade apart)
 * without pushing every red or blue of a 30-team league off its brand colour.
 */
export const MIN_DELTA_E = 10;
/** The step, as a fraction of the way to the target colour, of the last-resort mix. */
const STEP = 0.05;

const lin = (v: number): number => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t) / 116 + 16 / 116);
/** CIE Lab (D65) of a hex colour. */
function lab(color: string): [number, number, number] {
  const n = Number.parseInt(hex6(color, { dropAlpha: true }).slice(1), 16);
  const [r, g, b] = [lin(n >> 16), lin((n >> 8) & 255), lin(n & 255)];
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const finv = (t: number): number => (t > 6 / 29 ? t ** 3 : 3 * (6 / 29) ** 2 * (t - 4 / 29));
const gamma = (v: number): string => {
  const c = Math.min(1, Math.max(0, v)); // out of gamut: clipped, and the hex is what gets measured
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(s * 255)
    .toString(16)
    .padStart(2, "0");
};
/** The hex colour of a CIE Lab (D65) triple, clipped to sRGB. */
function fromLab([l, a, b]: readonly [number, number, number]): string {
  const fy = (l + 16) / 116;
  const [x, y, z] = [0.95047 * finv(fy + a / 500), finv(fy), 1.08883 * finv(fy - b / 200)];
  return `#${gamma(3.2406 * x - 1.5372 * y - 0.4986 * z)}${gamma(-0.9689 * x + 1.8758 * y + 0.0415 * z)}${gamma(0.0557 * x - 0.204 * y + 1.057 * z)}`;
}
const dist = (p: readonly number[], q: readonly number[]): number =>
  Math.hypot((p[0] ?? 0) - (q[0] ?? 0), (p[1] ?? 0) - (q[1] ?? 0), (p[2] ?? 0) - (q[2] ?? 0));
/** CIE76 ΔE: the Euclidean distance of two colours in Lab. */
export function deltaE(a: string, b: string): number {
  return dist(lab(a), lab(b));
}

// The synthetic search grid around a team colour, in LCh: lightness, hue and chroma steps. ponytail: a fixed grid of
// about 5,000 points per base colour, scanned only for a team whose brand colours both clash (milliseconds per palette).
const L_STEPS = Array.from({ length: 25 }, (_, k) => (k % 2 === 0 ? 1 : -1) * 4 * Math.ceil(k / 2)); // 0, -4, 4, … ±48
const H_STEPS = Array.from({ length: 36 }, (_, k) => (k % 2 === 0 ? 1 : -1) * 10 * Math.ceil(k / 2)); // 0, -10, 10, … 180
const C_STEPS = [0, -15, 15, -30, 30, 45];
/** Colours near `base`: its lightness, hue and chroma stepped, each clipped to sRGB. */
function nearby(base: string): string[] {
  const [l, a, b] = lab(base);
  const c = Math.hypot(a, b);
  const h = Math.atan2(b, a);
  const out: string[] = [];
  for (const dl of L_STEPS)
    for (const dh of H_STEPS)
      for (const dc of C_STEPS) {
        const cc = Math.max(0, c + dc);
        const hh = h + (dh * Math.PI) / 180;
        out.push(fromLab([Math.min(100, Math.max(0, l + dl)), cc * Math.cos(hh), cc * Math.sin(hh)]));
      }
  return out;
/** CIE76 ΔE: the Euclidean distance of two colours in Lab. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** `c`, else `alt`, else `c` mixed towards the background's ink until it reaches 3:1 against `bg`. */
export function readable(c: string, alt: string | null | undefined, bg: string): string {
  if (contrast(c, bg) >= MIN_CONTRAST) return c;
  if (alt != null && contrast(alt, bg) >= MIN_CONTRAST) return alt;
  const ink = onColor(bg);
  for (let t = STEP; t < 1; t += STEP) {
    const m = mix(c, ink, t);
    if (contrast(m, bg) >= MIN_CONTRAST) return m;
  }
  return ink;
}

/**
 * One colour per team for a chart on `background`, in order: each readable against it, and at least `MIN_DELTA_E`
 * from every earlier team's colour. A team whose readable colour is too close to an earlier one tries its other
 * colour (made readable); failing that, the colours near both (lightness, hue in LCh and chroma stepped) that are 3:1
 * and distinct, taking the one closest to the team's brand colour (ΔE; the first generated on a tie). Only when none
 * is left does it keep the readable colour and warn once. Deterministic: the same colours give the same palette. A
 * colour already readable and distinct is returned as it is.
 * colour (made readable), then its own colour stepped towards the background's ink or towards the background, by
 * `STEP`, until it is distinct and still 3:1; failing all of that it keeps the readable colour and warns once.
 * Deterministic: the same colours give the same palette. A colour already readable and distinct is returned as it is.
 *
 * @param colors - each team's colour (`#rrggbb`).
 * @param alts - each team's other colour, or null.
 * @param labels - names for the warning (default: the positions).
 */
export function teamPalette(
  colors: readonly string[],
  alts: readonly (string | null | undefined)[],
  background: string,
  labels: readonly string[] = colors.map((_, i) => `#${i + 1}`),
): string[] {
  const bg = hex6(background);
  const ink = onColor(bg);
  const out: string[] = [];
  const labs: [number, number, number][] = [];
  const clash = (c: string): number => {
    const p = lab(c);
    return labs.findIndex((q) => dist(p, q) < MIN_DELTA_E);
  };
  const ok = (c: string): boolean => contrast(c, bg) >= MIN_CONTRAST && clash(c) < 0;
  const keep = (c: string): void => {
    out.push(c);
    labs.push(lab(c));
  };
  colors.forEach((color, i) => {
    const alt = alts[i] ?? null;
    const first = readable(color, alt, bg);
    if (clash(first) < 0) return keep(first);
    const second = alt === null ? null : readable(alt, null, bg);
    if (second !== null && ok(second)) return keep(second);
    // the synthetic candidates, the one nearest the brand colour first
    const pool = [first];
    for (let t = STEP; t < 1; t += STEP) pool.push(mix(first, ink, t), mix(first, bg, t));
    pool.push(...nearby(first));
    if (second !== null) pool.push(...nearby(second));
    const brand = lab(color);
    let pick: string | undefined;
    let best = Number.POSITIVE_INFINITY;
    const seen = new Set<string>();
    for (const c of pool) {
      if (seen.has(c)) continue;
      seen.add(c);
      const d = dist(lab(c), brand);
      if (d < best && ok(c)) {
        pick = c;
        best = d;
      }
    }
    if (pick !== undefined) return keep(pick);
  const clash = (c: string): number => out.findIndex((p) => deltaE(c, p) < MIN_DELTA_E);
  colors.forEach((color, i) => {
    const alt = alts[i] ?? null;
    const first = readable(color, alt, bg);
    const tries = [alt === null ? null : readable(alt, null, bg)];
    for (let t = STEP; t < 1; t += STEP) tries.push(mix(first, ink, t), mix(first, bg, t));
    const pick =
      clash(first) < 0
        ? first
        : tries.find((c): c is string => c !== null && contrast(c, bg) >= MIN_CONTRAST && clash(c) < 0);
    if (pick !== undefined) return void out.push(pick);
    const j = clash(first);
    warn(
      `team-palette:${bg}:${labels[j]}:${labels[i]}`,
      `${labels[i]} (${first}) stays within ΔE ${MIN_DELTA_E} of ${labels[j]} (${out[j]}) on ${bg}: no readable colour of it is distinct`,
    );
    keep(first);
    out.push(first);
  });
  return out;
}
