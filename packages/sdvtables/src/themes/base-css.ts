// src/themes/base-css.ts
import type { ThemeTokens } from "./tokens.js";
import { TOKEN_KEYS } from "./tokens.js";
const kebab = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
export function tokensCSS(sel: string, t: ThemeTokens): string {
  return `${sel}{${TOKEN_KEYS.map((k) => `--sdvt-${kebab(k)}:${t[k]};`).join("")}}`;
}
export function BASE_CSS(sel: string): string {
  const s = sel;
  return [
    `${s}{display:inline-block;max-width:100%;background:var(--sdvt-bg);color:var(--sdvt-text);font-family:var(--sdvt-font-body);font-size:var(--sdvt-body-size);font-weight:var(--sdvt-body-weight);line-height:var(--sdvt-line-height)}`,
    `${s} table{border-collapse:collapse;border-spacing:0;width:auto;border-top:var(--sdvt-table-border-top);border-bottom:var(--sdvt-table-border-bottom);border-left:var(--sdvt-table-border-x);border-right:var(--sdvt-table-border-x)}`,
    `${s} caption{caption-side:top;text-align:var(--sdvt-heading-align);background:var(--sdvt-heading-bg);padding:var(--sdvt-heading-pad) 5px}`,
    `${s} .sdvt-title{font-family:var(--sdvt-font-title);font-weight:var(--sdvt-title-weight);font-size:var(--sdvt-title-size);color:var(--sdvt-title-color);text-transform:var(--sdvt-title-transform);letter-spacing:var(--sdvt-title-tracking)}`,
    `${s} .sdvt-subtitle{font-size:var(--sdvt-subtitle-size);font-style:var(--sdvt-subtitle-style);font-weight:var(--sdvt-subtitle-weight);color:var(--sdvt-subtitle-color)}`,
    `${s} thead{position:relative}${s} thead::after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--sdvt-horizon)}`,
    `${s} th.sdvt-label{font-family:var(--sdvt-font-label);font-weight:var(--sdvt-label-weight);font-size:var(--sdvt-label-size);font-style:var(--sdvt-label-style);color:var(--sdvt-label-color);background:var(--sdvt-label-bg);text-transform:var(--sdvt-label-transform);letter-spacing:var(--sdvt-label-tracking);border-top:var(--sdvt-label-border-top);border-bottom:var(--sdvt-label-border-bottom);padding:var(--sdvt-label-pad) 5px;vertical-align:bottom}`,
    `${s} .sdvt-subheader{display:block;font-weight:400;font-size:0.8em;color:var(--sdvt-muted);text-transform:none;letter-spacing:normal}`,
    `${s} th.sdvt-group{font-family:var(--sdvt-font-label);font-weight:var(--sdvt-group-weight);font-size:var(--sdvt-group-size);color:var(--sdvt-group-color);background:var(--sdvt-group-bg);text-transform:var(--sdvt-group-transform);border-top:var(--sdvt-group-border-top);border-bottom:var(--sdvt-group-border-bottom);text-align:left;padding:var(--sdvt-group-pad) 5px}`,
    `${s} td.sdvt-cell{padding:var(--sdvt-pad) 5px;border-top:var(--sdvt-hline);font-variant-numeric:tabular-nums;vertical-align:middle}`,
    `${s} tbody tr:first-child td.sdvt-cell{border-top:none}${s} tbody{border-bottom:var(--sdvt-body-border-bottom)}`,
    `${s} tr.sdvt-stripe td.sdvt-cell{background:var(--sdvt-stripe)}`,
    `${s} .sdvt-left{text-align:left}${s} .sdvt-center{text-align:center}${s} .sdvt-right{text-align:right}`,
    `${s} tfoot td{font-size:var(--sdvt-source-size);font-style:var(--sdvt-source-style);color:var(--sdvt-source-color);padding:var(--sdvt-source-pad) 5px;text-align:left}`,
    `${s} img.sdvt-mark{vertical-align:middle}`,
    `${s} table{--bs-table-bg:transparent;--bs-table-color:currentcolor}`, // utils-theme.R .theme_bs_host: Bootstrap hosts repaint td
  ].join("\n");
}
