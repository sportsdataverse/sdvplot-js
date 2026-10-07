// src/themes/athletic.ts — gt_theme_athletic (_themes.py:1317-1405): mono body, dotted row rules, column rules, black group bars.
// Hard-coded px in Python → written at "comfortable" and scaled by scaleFor(density) (sdvplotR .theme_scale_output()); great_tables' own defaults (8px rows) scale too.
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
export const athletic = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const k = scaleFor(ref.density);
  const sz = (n: number, role: Role): string => px(n * k[role]);
  const bg = "#FFFFFF";
  const work = fontStack("Work Sans");
  return {
    name: "athletic",
    tokens: {
      ...baseTokens(d, fontStack("Spline Sans Mono")),
      fontLabel: work,
      fontTitle: work,
      bg,
      hline: border(1.5, "black", "dotted"),
      titleWeight: "650",
      titleSize: sz(22, "title"),
      subtitleWeight: "500",
      subtitleSize: sz(14, "subtitle"),
      labelBg: bg,
      labelWeight: "650",
      labelSize: sz(12, "label"),
      labelTransform: "uppercase",
      labelBorderBottom: border(1, "black"),
      labelPad: sz(5, "pad"),
      groupBg: "black",
      groupColor: "white",
      groupWeight: "650",
      groupSize: sz(12, "group"),
      groupBorderBottom: border(1, "black"),
      groupPad: sz(1.5, "pad"),
      bodySize: sz(12, "body"),
      bodyWeight: "500",
      pad: sz(8, "pad"),
      headingPad: sz(4, "pad"),
      sourcePad: sz(4, "pad"),
      bodyBorderBottom: border(2, "#D3D3D3"),
      sourceSize: sz(10, "source"),
    },
    fonts: [
      { family: "Spline Sans Mono", weights: [500] },
      { family: "Work Sans", weights: [500, 650] },
    ],
    rules: (s) =>
      [
        `${s} td.sdvt-cell:not(:first-child){border-left:0.5px solid black}`,
        `${s} td.sdvt-cell,${s} th.sdvt-label{text-align:center}`,
        `${s} caption{padding-top:6px;padding-bottom:0}`,
        `${s} .sdvt-subtitle{display:block;padding:0 0 4px}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
