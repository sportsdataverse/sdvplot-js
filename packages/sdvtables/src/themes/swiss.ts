// src/themes/swiss.ts — gt_theme_swiss (_themes.py:574-669): generous padding does the separating, one rule under the labels
import type { ThemeRef } from "../spec.js";
import { type Theme, baseTokens, border, densitySizes, fontStack, hexOption, px } from "./tokens.js";
export const swiss = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const accent = hexOption(ref.options?.accent ?? "#111111", "accent");
  const ink = "#111111";
  const secondary = "#6B6B6B"; // 5.28:1 on white; #7A7A7A missed 4.5
  const bg = "#FFFFFF";
  return {
    name: "swiss",
    tokens: {
      ...baseTokens(d, fontStack("Archivo")),
      bg,
      text: ink,
      muted: secondary,
      accent,
      headingBg: bg,
      titleColor: ink,
      titleSize: px(d.title + 4),
      titleTracking: "-0.02em",
      subtitleColor: secondary,
      subtitleWeight: "400",
      subtitleSize: px(d.subtitle),
      labelBg: bg,
      labelColor: ink,
      labelWeight: "500",
      labelSize: px(d.label),
      labelTransform: "uppercase",
      labelTracking: "0.12em",
      labelBorderBottom: border(1, accent),
      labelPad: px(d.pad + 2),
      groupBg: bg,
      groupColor: secondary,
      groupWeight: "500",
      groupSize: px(d.group),
      groupTransform: "uppercase",
      groupPad: px(d.pad + 6),
      bodySize: px(d.body),
      pad: px(d.pad + 5),
      headingPad: px(d.pad + 4),
      sourcePad: px(d.pad + 4),
      bodyBorderBottom: border(1, ink),
      sourceColor: secondary,
      sourceSize: px(d.source),
    },
    fonts: [{ family: "Archivo", weights: [400, 500, 700] }],
    rules: (s) =>
      [
        `${s} th.sdvt-group{letter-spacing:0.12em}`,
        `${s} .sdvt-subtitle{display:block;padding-bottom:${px(d.pad + 14)}}${s} .sdvt-title{display:block;padding-bottom:${px(Math.ceil(d.pad / 2))}}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
