// src/themes/luminance.ts — gt::adjust_luminance(), a line-for-line port of Python `_themes._adjust_luminance` (_themes.py:179-239)
import { hex6 } from "@sportsdataverse/sdvplot";
const c2to3 = (x: number, y: number): [number, number, number] => [x / y, 1, (1 - x - y) / y];
// grDevices make.rgb(): sRGB primaries and R's own D65 white point (0.3137, 0.3291)
const P = [c2to3(0.64, 0.33), c2to3(0.3, 0.6), c2to3(0.15, 0.06)] as const;
const WHITE = c2to3(0.3137, 0.3291);
const at = (m: readonly (readonly number[])[], i: number, j: number): number => m[i]?.[j] ?? 0;
const DET =
  at(P, 0, 0) * (at(P, 1, 1) * at(P, 2, 2) - at(P, 1, 2) * at(P, 2, 1)) -
  at(P, 0, 1) * (at(P, 1, 0) * at(P, 2, 2) - at(P, 1, 2) * at(P, 2, 0)) +
  at(P, 0, 2) * (at(P, 1, 0) * at(P, 2, 1) - at(P, 1, 1) * at(P, 2, 0));
const INV = [0, 1, 2].map((i) =>
  [0, 1, 2].map(
    (j) =>
      (at(P, (j + 1) % 3, (i + 1) % 3) * at(P, (j + 2) % 3, (i + 2) % 3) -
        at(P, (j + 1) % 3, (i + 2) % 3) * at(P, (j + 2) % 3, (i + 1) % 3)) /
      DET,
  ),
);
const S = [0, 1, 2].map((j) => [0, 1, 2].reduce((acc, k) => acc + (WHITE[k] ?? 0) * at(INV, k, j), 0));
const M = [0, 1, 2].map((r) => [0, 1, 2].map((j) => (S[r] ?? 0) * at(P, r, j)));
/** Shift a color's HCL luminance `steps` along a logistic curve (R's grDevices math). */
export function adjustLuminance(color: string, steps: number): string {
  const c = hex6(color);
  const lin = [1, 3, 5]
    .map((i) => Number.parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v < 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const [x, y, z] = [0, 1, 2].map((j) =>
    [0, 1, 2].reduce((acc, k) => acc + (lin[k] ?? 0) * at(M, k, j), 0),
  ) as [number, number, number];
  const [wx, wy, wz] = WHITE;
  const denom = x + 15 * y + 3 * z;
  const wdenom = wx + 15 * wy + 3 * wz;
  const [u1, v1] = denom ? [(4 * x) / denom, (9 * y) / denom] : [1, 1];
  const yr = y / wy;
  let lum = yr <= 216 / 24389 ? (24389 / 27) * yr : 116 * yr ** (1 / 3) - 16;
  const u = 13 * lum * (u1 - (4 * wx) / wdenom);
  const v = 13 * lum * (v1 - (9 * wy) / wdenom);
  const hue = Math.atan2(v, u);
  const chroma = Math.hypot(u, v);
  const frac = lum / 100;
  if (frac <= 0) return "#000000";
  lum = frac >= 1 ? 100 : 100 / (1 + Math.exp(-(Math.log(frac / (1 - frac)) + steps)));
  // grDevices hcl(h, c, l): polar Luv back to sRGB, clamped into gamut
  const yy = 100 * (lum > 7.999592 ? ((lum + 16) / 116) ** 3 : lum / 903.3);
  const uu = (chroma * Math.cos(hue)) / (13 * lum) + 0.1978398;
  const vv = (chroma * Math.sin(hue)) / (13 * lum) + 0.4683363;
  const xx = (9 * yy * uu) / (4 * vv);
  const zz = -xx / 3 - 5 * yy + (3 * yy) / vv;
  const gamma = (t: number): number => (t > 0.00304 ? 1.055 * t ** (1 / 2.4) - 0.055 : 12.92 * t);
  const out = [
    gamma((3.240479 * xx - 1.53715 * yy - 0.498535 * zz) / 100),
    gamma((-0.969256 * xx + 1.875992 * yy + 0.041556 * zz) / 100),
    gamma((0.055648 * xx - 0.204043 * yy + 1.057311 * zz) / 100),
  ];
  return `#${out
    .map((t) =>
      Math.min(255, Math.max(0, Math.trunc(255 * t + 0.5)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
