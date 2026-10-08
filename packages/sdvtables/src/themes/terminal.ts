// src/themes/terminal.ts — gt_theme_terminal (_themes.py:1212-1314): monospace readout on a near-black ground, a rule on every row
import type { ThemeRef } from "../spec.js";
import { type Theme, baseTokens, border, densitySizes, fontStack, hexOption, px } from "./tokens.js";
export const terminal = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const accent = hexOption(ref.options?.accent ?? "#FFB86C", "accent");
  const ground = "#0F1115";
  const primary = "#C9D1D9";
  const secondary = "#7D8590";
  const rule = "#262B33";
  return {
    name: "terminal",
    tokens: {
      ...baseTokens(d, fontStack("JetBrains Mono")),
      bg: ground,
      text: primary,
      muted: secondary,
      accent,
      rule,
      hline: border(1, rule),
      headingBg: ground,
      titleColor: primary,
      titleSize: px(d.title - 2),
      titleTransform: "uppercase",
      titleTracking: "0.04em",
      subtitleColor: secondary,
      subtitleWeight: "400",
      subtitleSize: px(d.subtitle - 1),
      labelBg: ground,
      labelColor: accent,
      labelWeight: "700",
      labelSize: px(d.label),
      labelTransform: "uppercase",
      labelTracking: "0.08em",
      labelBorderBottom: border(1, accent),
      labelPad: px(d.pad + 1),
      groupBg: ground,
      groupColor: accent,
      groupWeight: "700",
      groupSize: px(d.group),
      groupTransform: "uppercase",
      groupBorderTop: border(1, rule),
      groupPad: px(Math.max(d.pad, 3)),
      bodySize: px(d.body),
      pad: px(d.pad),
      headingPad: px(d.pad + 2),
      sourcePad: px(d.pad + 2),
      lineHeight: "1.5",
      tableBorderTop: border(1, accent),
      tableBorderBottom: border(1, rule),
      sourceColor: secondary,
      sourceSize: px(d.source),
    },
    fonts: [{ family: "JetBrains Mono", weights: [400, 700] }],
    rules: (s) =>
      [
        `${s} .sdvt-subtitle{display:block;padding-bottom:${px(d.pad + 6)}}${s} .sdvt-title{display:block;padding-bottom:2px}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${ground}}`,
      ].join("\n"),
  };
};
