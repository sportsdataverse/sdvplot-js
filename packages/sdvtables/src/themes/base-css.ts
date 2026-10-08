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
    `${s} .sdvt-subtitle{display:block;font-size:var(--sdvt-subtitle-size);font-style:var(--sdvt-subtitle-style);font-weight:var(--sdvt-subtitle-weight);color:var(--sdvt-subtitle-color)}`, // great_tables draws the subtitle on its own heading row in every theme
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
    `${s} img{max-width:none}`, // A47: a host img{max-width:100%} reset (Docusaurus, Tailwind preflight) squashed cell logos
    `${s} table{--bs-table-bg:transparent;--bs-table-color:currentcolor}`, // utils-theme.R .theme_bs_host: Bootstrap hosts repaint td
    // Phase 5 controls: renderHTML(table), hydrate and <SdvTable/> (the last rule is J31 A5, a neutral selected-row overlay)
    `${s} .sdvt-sort{all:unset;cursor:pointer;display:inline-block;width:100%}`,
    `${s} .sdvt-sort:focus-visible{outline:2px solid currentColor;outline-offset:2px}`, // all:unset drops the UA focus ring (WCAG 2.4.7)
    // the arrow repeats aria-sort, so its alt text is empty (kept out of the button name); the plain declaration is the fallback
    `${s} th[aria-sort="ascending"] .sdvt-sort::after{content:" ▲";content:" ▲"/"";font-size:.7em}`,
    `${s} th[aria-sort="descending"] .sdvt-sort::after{content:" ▼";content:" ▼"/"";font-size:.7em}`,
    `${s} .sdvt-toolbar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}`,
    // I4 (WCAG 1.4.11): the theme's rule taken 60% of the way to the text colour, 3:1 or better on the table background
    // in every theme (a black or ink rule stays itself); where color-mix is unsupported, the text colour
    `${s} .sdvt-toolbar input{font:inherit;padding:2px 6px;border:1px solid var(--sdvt-text);border-color:color-mix(in srgb,var(--sdvt-text) 60%,var(--sdvt-rule));background:var(--sdvt-bg);color:var(--sdvt-text)}`,
    `${s} .sdvt-pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:6px}`,
    `${s} .sdvt-page{font:inherit;cursor:pointer}`,
    `${s} .sdvt-page[aria-disabled="true"]{opacity:.4;cursor:default}`, // M1: aria-disabled, so focus stays on an edge button
    `${s} tr.sdvt-selected>td{box-shadow:inset 0 0 0 9999px rgba(127,127,127,.18)}`,
    `${s} tr.sdvt-selected>td:first-child{box-shadow:inset 3px 0 0 var(--sdvt-text),inset 0 0 0 9999px rgba(127,127,127,.18)}`, // I4: the tint is 1.2:1; a text-coloured bar gives the state 3:1
    // J31 (A29): a hovered row (its own pointer, or a linked figure's) gets a text-coloured underline, 3:1 like I4's bar.
    // A background image: it sits beside the selected overlay (box-shadow) and moves no layout; after the stripe rule,
    // whose `background` shorthand would otherwise reset it
    `${s} tr.sdvt-hover>td.sdvt-cell{background-image:linear-gradient(var(--sdvt-text),var(--sdvt-text));background-size:100% 2px;background-position:0 100%;background-repeat:no-repeat}`,
    `${s} tr.sdvt-row:focus-visible{outline:2px solid currentColor;outline-offset:-2px}`, // Task 10: the grid's tab stop (WCAG 2.4.7)
    `${s} th.sdvt-col-current .sdvt-sort{text-decoration:underline;text-underline-offset:4px}`, // Task 10: the column `s` sorts
  ].join("\n");
}
