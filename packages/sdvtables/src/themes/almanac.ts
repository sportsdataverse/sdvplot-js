// src/themes/almanac.ts — gt_theme_almanac (_themes.py:241-348): a slab body, narrow condensed labels, tight rows, banded stripes
import type { ThemeRef } from "../spec.js";
import { type Theme, baseTokens, border, densitySizes, fontStack, hexOption, px } from "./tokens.js";
export const almanac = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const accent = hexOption(ref.options?.accent ?? "#8C2F1E", "accent");
  const stripeOpt = ref.options?.stripe ?? "#F1F1EF";
  const stripe = stripeOpt === "none" ? "transparent" : hexOption(stripeOpt, "stripe"); // Python stripe=None → no banding
  const ink = "#1A1A1A";
  const secondary = "#6B6B68";
  const rule = "#D8D8D4";
  const bg = "#FFFFFF";
  const narrow = fontStack("Archivo Narrow");
  return {
    name: "almanac",
    tokens: {
      ...baseTokens(d, fontStack("Zilla Slab")),
      fontLabel: narrow,
      bg,
      text: ink,
      muted: secondary,
      accent,
      rule,
      stripe,
      headingBg: bg,
      titleColor: ink,
      titleSize: px(d.title),
      subtitleColor: secondary,
      subtitleWeight: "400",
      subtitleSize: px(d.subtitle),
      labelBg: bg,
      labelColor: ink,
      labelWeight: "700",
      labelSize: px(d.label + 1),
      labelTransform: "uppercase",
      labelTracking: "0.05em",
      labelBorderBottom: border(1.5, ink),
      labelPad: px(d.pad + 1),
      groupBg: bg,
      groupColor: accent,
      groupWeight: "700",
      groupSize: px(d.group + 1),
      groupTransform: "uppercase",
      groupBorderTop: border(1, rule),
      groupPad: px(Math.max(d.pad, 3)),
      bodySize: px(d.body),
      pad: px(d.pad),
      headingPad: px(d.pad + 2),
      sourcePad: px(d.pad + 2),
      bodyBorderBottom: border(1, ink),
      tableBorderTop: border(2, accent),
      sourceColor: secondary,
      sourceSize: px(d.source + 1),
    },
    fonts: [
      { family: "Zilla Slab", weights: [400, 700] },
      { family: "Archivo Narrow", weights: [700] },
    ],
    rules: (s) =>
      [
        `${s} th.sdvt-group{letter-spacing:0.05em}`,
        `${s} tfoot td{font-family:${narrow}}`,
        `${s} .sdvt-subtitle{display:block;padding-bottom:${px(d.pad + 6)}}${s} .sdvt-title{display:block;padding-bottom:${px(Math.ceil(d.pad / 2))}}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
