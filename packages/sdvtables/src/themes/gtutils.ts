// src/themes/gtutils.ts — gt_theme_gtutils (_themes.py:1408-1498): cream ground, centered cells, a rule under every row but the last.
// Hard-coded px in Python → written at "comfortable" and scaled by scaleFor(density). Nothing sets the table font, title or subtitle size, so
// great_tables' defaults apply: a 16px table font, a 125% title and an 85% subtitle (percentages follow the table font, hence the body role).
import type { ThemeRef } from "../spec.js";
import {
  type Role,
  type Theme,
  baseTokens,
  border,
  densitySizes,
  fontStack,
  px,
  scaleFor,
} from "./tokens.js";
export const gtutils = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const k = scaleFor(ref.density);
  const sz = (n: number, role: Role): string => px(n * k[role]);
  const bg = "#FFFDF5";
  const rule = "#8A817C";
  const signika = fontStack("Signika Negative");
  return {
    name: "gtutils",
    tokens: {
      ...baseTokens(d, fontStack("Almarai")),
      fontLabel: signika,
      fontTitle: signika,
      bg,
      rule,
      hline: border(1, rule),
      titleWeight: "650",
      titleSize: sz(20, "body"),
      subtitleWeight: "500",
      subtitleSize: sz(13.6, "body"),
      labelBg: bg,
      labelWeight: "650",
      labelSize: sz(14, "label"),
      labelBorderBottom: border(1, "black"),
      labelPad: "2px",
      groupBg: rule,
      groupColor: bg,
      groupWeight: "650",
      groupSize: sz(14, "group"),
      groupBorderBottom: border(1, "black"),
      groupPad: sz(1.5, "pad"),
      bodySize: sz(16, "body"),
      bodyWeight: "500",
      pad: sz(1, "pad"),
      headingPad: sz(4, "pad"),
      sourcePad: sz(4, "pad"),
      bodyBorderBottom: border(2, "#D3D3D3"),
      sourceSize: sz(12, "source"),
    },
    fonts: [
      { family: "Almarai", weights: [400, 500, 700] },
      { family: "Signika Negative", weights: [500, 650] },
    ],
    rules: (s) =>
      [
        `${s} td.sdvt-cell,${s} th.sdvt-label{text-align:center}`,
        `${s} caption{padding-top:6px;padding-bottom:0}`,
        `${s} .sdvt-subtitle{display:block;padding:0 0 4px}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
