// src/themes/tufte.ts — gt_theme_tufte (_themes.py:672-767): italic de-emphasized labels, one hairline, cream paper
import type { ThemeRef } from "../spec.js";
import { type Theme, baseTokens, border, densitySizes, fontStack, hexOption, px } from "./tokens.js";
export const tufte = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const accent = hexOption(ref.options?.accent ?? "#111111", "accent");
  const ink = "#111111";
  const secondary = "#6F6A60";
  const hair = "#C9C4B8";
  const bg = "#FFFFF8";
  return {
    name: "tufte",
    tokens: {
      ...baseTokens(d, fontStack("EB Garamond")),
      bg,
      text: ink,
      muted: secondary,
      accent,
      rule: hair,
      headingBg: bg,
      titleColor: ink,
      titleWeight: "500",
      titleSize: px(d.title),
      subtitleColor: secondary,
      subtitleStyle: "italic",
      subtitleSize: px(d.subtitle),
      labelBg: bg,
      labelColor: secondary,
      labelWeight: "400",
      labelStyle: "italic",
      labelSize: px(d.label + 2),
      labelBorderBottom: border(1, accent),
      labelPad: px(Math.max(d.pad - 1, 2)),
      groupBg: bg,
      groupColor: accent,
      groupWeight: "600",
      groupSize: px(d.group + 2),
      groupPad: px(Math.max(d.pad - 1, 2)),
      bodySize: px(d.body + 1),
      pad: px(d.pad),
      bodyBorderBottom: border(1, hair),
      sourceColor: secondary,
      sourceSize: px(d.source + 1),
      sourceStyle: "italic",
    },
    fonts: [{ family: "EB Garamond", weights: [400, 500, 600], italic: true }],
    rules: (s) =>
      [`${s} th.sdvt-group{font-style:italic}`, `${s} tfoot td{padding-top:${px(d.pad + 4)}}`].join("\n"),
  };
};
