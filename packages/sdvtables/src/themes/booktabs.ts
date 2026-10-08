// src/themes/booktabs.ts — gt_theme_booktabs (_themes.py:351-448): three horizontal rules and nothing else, in a serif
import type { ThemeRef } from "../spec.js";
import { type Theme, baseTokens, border, densitySizes, fontStack, hexOption, px } from "./tokens.js";
export const booktabs = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const accent = hexOption(ref.options?.accent ?? "#111111", "accent");
  const ink = "#111111";
  const secondary = "#5A5A5A";
  const bg = "#FFFFFF";
  return {
    name: "booktabs",
    tokens: {
      ...baseTokens(d, fontStack("Tinos")),
      bg,
      text: ink,
      muted: secondary,
      accent,
      titleColor: ink,
      titleSize: px(d.title),
      subtitleColor: secondary,
      subtitleStyle: "italic",
      subtitleSize: px(d.subtitle),
      labelBg: bg,
      labelColor: ink,
      labelWeight: "700",
      labelSize: px(d.label + 1),
      labelBorderTop: border(2, accent),
      labelBorderBottom: border(1, accent),
      labelPad: px(Math.max(d.pad - 1, 2)),
      groupBg: bg,
      groupColor: accent,
      groupWeight: "700",
      groupSize: px(d.group + 1),
      groupBorderTop: border(1, accent),
      groupPad: px(Math.max(d.pad - 2, 2)),
      bodySize: px(d.body),
      pad: px(d.pad),
      bodyBorderBottom: border(2, accent),
      sourceColor: secondary,
      sourceSize: px(d.source),
    },
    fonts: [{ family: "Tinos", weights: [400, 700], italic: true }],
    rules: (s) =>
      [
        `${s} th.sdvt-group{font-style:italic}`,
        `${s} tfoot td{padding-top:${px(d.pad + 4)}}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
