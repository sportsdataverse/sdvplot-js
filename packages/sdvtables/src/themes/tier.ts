// src/themes/tier.ts — gt_theme_tier (_themes.py:1971-2055): Oswald on near-black (or white), centered cells, a rule under every row but the last.
// Hard-coded px in Python → written at "comfortable" and scaled by scaleFor(density). Only the title and subtitle are styled, so great_tables'
// defaults apply elsewhere: a 16px table font, 100% labels and group rows, 90% notes (percentages follow the table font, hence the body role).
// great_tables switches the text to white on the dark ground.
import { TableSpecError } from "../errors.js";
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
export const tier = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const k = scaleFor(ref.density);
  const sz = (n: number, role: Role): string => px(n * k[role]);
  const style = ref.options?.style ?? "dark";
  if (style !== "light" && style !== "dark")
    throw new TableSpecError(`tier theme style must be "light" or "dark", not "${style}"`);
  const bg = style === "dark" ? "#1a1a17" : "#ffffff";
  return {
    name: "tier",
    tokens: {
      ...baseTokens(d, fontStack("Oswald")),
      bg,
      text: style === "dark" ? "#FFFFFF" : "#333333",
      hline: border(1, "black"),
      titleWeight: "650",
      titleSize: sz(20, "body"),
      subtitleWeight: "500",
      subtitleSize: sz(13.6, "body"),
      labelBg: bg,
      labelWeight: "400",
      labelSize: sz(16, "body"),
      labelPad: "2px",
      groupBg: bg,
      groupWeight: "400",
      groupSize: sz(16, "body"),
      groupBorderBottom: border(1, "black"),
      groupPad: sz(1.5, "pad"),
      bodySize: sz(16, "body"),
      bodyWeight: "500",
      pad: sz(1, "pad"),
      headingPad: sz(4, "pad"),
      sourcePad: sz(4, "pad"),
      bodyBorderBottom: border(2, "#D3D3D3"),
      sourceSize: sz(14.4, "body"),
    },
    fonts: [{ family: "Oswald", weights: [500, 650] }],
    rules: (s) =>
      [
        `${s} td.sdvt-cell,${s} th.sdvt-label{text-align:center}`,
        `${s} caption{padding-top:6px;padding-bottom:0}`,
        `${s} .sdvt-subtitle{display:block;padding:0 0 4px}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
