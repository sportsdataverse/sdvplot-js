// src/themes/drench.ts — gt_theme_drench (_themes.py:884-995): the whole table in one saturated hue; ink, rule and band derive from it
import { onColor } from "@sportsdataverse/sdvplot";
import type { ThemeRef } from "../spec.js";
import { adjustLuminance } from "./luminance.js";
import { secondaryOn } from "./sdv.js";
import { type Theme, baseTokens, border, densitySizes, fontStack, hexOption, px } from "./tokens.js";
export const drench = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const color = hexOption(ref.options?.color ?? "#123F5E", "color");
  const ink = onColor(color);
  const darkType = ink === "#000000";
  const rule = adjustLuminance(color, darkType ? -0.6 : 0.9); // shift the ground rather than laying gray over it
  const surface = adjustLuminance(color, darkType ? 0.5 : -0.7);
  const secondary = secondaryOn(color, ink, 4.5);
  return {
    name: "drench",
    tokens: {
      ...baseTokens(d, fontStack("Gabarito")),
      bg: color,
      text: ink,
      muted: secondary,
      accent: ink,
      rule,
      hline: border(1, rule),
      headingBg: color,
      titleColor: ink,
      titleSize: px(d.title + 2),
      subtitleColor: secondary,
      subtitleWeight: "400",
      subtitleSize: px(d.subtitle),
      labelBg: color,
      labelColor: secondary,
      labelWeight: "700",
      labelSize: px(d.label),
      labelTransform: "uppercase",
      labelTracking: "0.08em",
      labelBorderBottom: border(1, rule),
      labelPad: px(d.pad + 1),
      groupBg: surface,
      groupColor: ink,
      groupWeight: "700",
      groupSize: px(d.group),
      groupTransform: "uppercase",
      groupPad: px(Math.max(d.pad - 1, 3)),
      bodySize: px(d.body),
      bodyWeight: "500",
      pad: px(d.pad + 1),
      headingPad: px(d.pad + 2),
      sourcePad: px(d.pad + 2),
      lineHeight: darkType ? "normal" : "1.55", // light type on a saturated ground reads lighter than it is
      sourceColor: secondary,
      sourceSize: px(d.source),
    },
    fonts: [{ family: "Gabarito", weights: [400, 500, 700] }],
    rules: (s) =>
      [
        `${s} th.sdvt-group{letter-spacing:0.06em}`,
        `${s} .sdvt-subtitle{display:block;padding-bottom:${px(d.pad + 8)}}${s} .sdvt-title{display:block;padding-bottom:${px(Math.ceil(d.pad / 2))}}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${color}}`,
      ].join("\n"),
  };
};
