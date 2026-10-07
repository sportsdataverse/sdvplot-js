// src/themes/sofa.ts — gt_theme_sofa (_themes.py:1880-1968): Sofia Sans Condensed on cream (or navy), no rules between rows.
// Hard-coded px in Python → written at "comfortable" and scaled by scaleFor(density). great_tables switches the text to white on the navy ground.
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
export const sofa = (ref: ThemeRef): Theme => {
  const d = densitySizes(ref.density);
  const k = scaleFor(ref.density);
  const sz = (n: number, role: Role): string => px(n * k[role]);
  const style = ref.options?.style ?? "light";
  if (style !== "light" && style !== "dark")
    throw new TableSpecError(`sofa theme style must be "light" or "dark", not "${style}"`);
  const bg = style === "light" ? "#F0EAD6" : "#1c2632";
  return {
    name: "sofa",
    tokens: {
      ...baseTokens(d, fontStack("Sofia Sans Condensed")),
      bg,
      text: style === "light" ? "#333333" : "#FFFFFF",
      hline: border(1, "transparent"),
      titleSize: sz(22, "title"),
      subtitleWeight: "400",
      subtitleSize: sz(14, "subtitle"),
      labelBg: bg,
      labelWeight: "bold",
      labelSize: sz(14, "label"),
      labelPad: "2px",
      groupBg: bg,
      groupWeight: "bold",
      groupSize: sz(14, "group"),
      groupBorderBottom: border(1, "black"),
      groupPad: sz(1.5, "pad"),
      bodySize: sz(14, "body"),
      pad: sz(1, "pad"),
      headingPad: sz(4, "pad"),
      sourcePad: sz(4, "pad"),
      bodyBorderBottom: border(2, "#D3D3D3"),
      sourceSize: sz(10, "source"),
    },
    fonts: [{ family: "Sofia Sans Condensed", weights: [400, 650, 700] }],
    rules: (s) =>
      [
        `${s} caption{padding-top:6px;padding-bottom:0}`,
        `${s} .sdvt-subtitle{display:block;padding:0 0 4px}`,
        `${s} tbody tr:last-child td{border-bottom:2px solid ${bg}}`,
      ].join("\n"),
  };
};
