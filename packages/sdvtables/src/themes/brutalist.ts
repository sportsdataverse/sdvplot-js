// src/themes/brutalist.ts — gt_theme_brutalist (_themes.py:770-881): heavy black frame, knocked-out label bar, Archivo Black headline
import type { ThemeRef } from "../spec.js";
import { type Theme, baseTokens, border, densitySizes, fontStack, hexOption, px } from "./tokens.js";
export const brutalist = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const accent = hexOption(ref.options?.accent ?? "#FF3B00", "accent");
  const ink = "#000000";
  const bg = "#FFFFFF";
  const frame = border(3, ink);
  return {
    name: "brutalist",
    tokens: {
      ...baseTokens(d, fontStack("Archivo")),
      fontTitle: fontStack("Archivo Black"),
      bg,
      text: ink,
      muted: ink,
      accent,
      rule: ink,
      hline: border(1, ink),
      headingBg: bg,
      titleColor: ink,
      titleWeight: "400", // Archivo Black carries its own weight; Python sets none
      titleSize: px(d.title + 6),
      titleTransform: "uppercase",
      titleTracking: "-0.02em",
      subtitleColor: ink,
      subtitleWeight: "600",
      subtitleSize: px(d.subtitle),
      labelBg: ink,
      labelColor: "#FFFFFF",
      labelWeight: "700",
      labelSize: px(d.label + 1),
      labelTransform: "uppercase",
      labelTracking: "0.04em",
      labelPad: px(d.pad),
      groupBg: bg,
      groupColor: accent,
      groupWeight: "700",
      groupSize: px(d.group + 1),
      groupTransform: "uppercase",
      groupBorderTop: border(2, ink),
      groupPad: px(Math.max(d.pad - 1, 3)),
      bodySize: px(d.body),
      bodyWeight: "500",
      pad: px(d.pad),
      headingPad: px(d.pad + 2),
      sourcePad: px(d.pad + 2),
      tableBorderTop: frame,
      tableBorderBottom: frame,
      tableBorderX: frame,
      sourceColor: ink,
      sourceSize: px(d.source),
    },
    fonts: [
      { family: "Archivo", weights: [500, 600, 700] },
      { family: "Archivo Black", weights: [400] },
    ],
    rules: (s) =>
      [
        `${s} caption{border-bottom:3px solid ${ink}}`,
        `${s} th.sdvt-group{letter-spacing:0.06em}`,
        `${s} tfoot td{font-weight:500}`,
        `${s} .sdvt-subtitle{display:block;padding-bottom:${px(d.pad + 2)}}${s} .sdvt-title{display:block;line-height:1.05;padding-bottom:${px(Math.ceil(d.pad / 2))}}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
