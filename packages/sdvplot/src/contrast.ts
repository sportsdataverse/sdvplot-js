import { InputError } from "./errors.js";

/** A color as lowercase `#rrggbb`: accepts `#rgb`, `#rrggbb`, `#rgba`, `#rrggbbaa` (`#` optional). Transparency throws unless `dropAlpha`. */
export function hex6(color: string, opts: { dropAlpha?: boolean } = {}): string {
  let c = String(color).trim().replace(/^#+/, "");
  if (c.length === 3 || c.length === 4) c = [...c].map((ch) => ch + ch).join("");
  if ((c.length !== 6 && c.length !== 8) || !/^[0-9a-fA-F]+$/.test(c))
    throw new InputError(`not a hex color: ${JSON.stringify(color)}`);
  if (c.length === 8 && c.slice(6).toLowerCase() !== "ff" && !opts.dropAlpha)
    throw new InputError(
      `${JSON.stringify(color)} has transparency; give an opaque color such as '#${c.slice(0, 6).toLowerCase()}'`,
    );
  return `#${c.slice(0, 6).toLowerCase()}`;
}

const channels = (c: string): [number, number, number] => [
  Number.parseInt(c.slice(1, 3), 16),
  Number.parseInt(c.slice(3, 5), 16),
  Number.parseInt(c.slice(5, 7), 16),
];

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(color: string): number {
  const [r, g, b] = channels(hex6(color)).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (same) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Black or white, whichever reads better on `background`. */
export function onColor(background: string): string {
  return contrast("#000000", background) >= contrast("#ffffff", background) ? "#000000" : "#ffffff";
}

/** Python's builtin round(): half to even (inputs are non-negative). */
function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  return d > 0.5 || (d === 0.5 && f % 2 !== 0) ? f + 1 : f;
}

/** The color `t` of the way from `a` to `b` in sRGB (`t` in [0, 1]). */
export function mix(a: string, b: string, t: number): string {
  if (!(t >= 0 && t <= 1)) throw new InputError(`t must be in [0, 1], got ${t}`);
  const ca = channels(hex6(a));
  const cb = channels(hex6(b));
  return `#${ca
    .map((v, i) =>
      roundHalfEven(v * (1 - t) + (cb[i] as number) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** The opaque `#rrggbb` a hex color shows as over `background`: a translucent color is alpha-composited onto it. */
export function solid(color: string, background = "#ffffff"): string {
  const opaque = hex6(color, { dropAlpha: true });
  let c = String(color).trim().replace(/^#+/, "");
  if (c.length === 4) c = [...c].map((ch) => ch + ch).join("");
  const alpha = c.length === 8 ? Number.parseInt(c.slice(6), 16) / 255 : 1;
  return mix(background, opaque, alpha);
}
