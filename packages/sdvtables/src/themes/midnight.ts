// src/themes/midnight.ts — gt_theme_midnight (_themes.py:998-1099): light type on a near-black ground, a raised label band, one cool accent
import type { ThemeRef } from "../spec.js";
import { type Theme, baseTokens, border, densitySizes, fontStack, hexOption, px } from "./tokens.js";
export const midnight = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const accent = hexOption(ref.options?.accent ?? "#5B8DEF", "accent"); // lowercased, as Python _color → hex6
  const ground = "#0C0D10";
  const surface = "#16181D";
  const primary = "#E8E9ED";
  const secondary = "#9498A3";
  const rule = "#24272E";
  return {
    name: "midnight",
    tokens: {
      ...baseTokens(d, fontStack("Chivo")),
      bg: ground,
      text: primary,
      muted: secondary,
      accent,
      rule,
      hline: border(1, rule),
      headingBg: ground,
      titleColor: primary,
      titleWeight: "700",
      titleSize: px(d.title),
      subtitleColor: secondary,
      subtitleWeight: "400",
      subtitleSize: px(d.subtitle),
      labelBg: surface,
      labelColor: secondary,
      labelWeight: "600",
      labelSize: px(d.label + 1),
      labelBorderBottom: border(1, rule),
      labelPad: px(Math.max(d.pad - 1, 3)),
      groupBg: ground,
      groupColor: accent,
      groupWeight: "700",
      groupSize: px(d.group),
      groupBorderTop: border(1, rule),
      groupPad: px(Math.max(d.pad - 2, 2)),
      bodySize: px(d.body),
      pad: px(d.pad),
      lineHeight: "1.55", // light on dark reads lighter than it is
      bodyBorderBottom: border(1, rule),
      tableBorderTop: border(2, accent),
      sourceColor: secondary,
      sourceSize: px(d.source),
    },
    fonts: [{ family: "Chivo", weights: [400, 600, 700] }],
    rules: (s) =>
      [
        `${s} .sdvt-subtitle{display:block;padding-bottom:${px(d.pad + 8)}}${s} .sdvt-title{display:block;padding-bottom:${px(Math.ceil(d.pad / 2))}}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${ground}}`,
      ].join("\n"),
  };
};
