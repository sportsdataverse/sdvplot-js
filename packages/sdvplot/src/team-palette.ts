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
    out.push(first);
  });
  return out;
}
