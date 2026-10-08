import { contrast, loadLeague, mix } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { BASE_CSS } from "../src/themes/base-css.js";
import { THEME_NAMES, resolveTheme } from "../src/themes/index.js";
import type { Theme, ThemeTokens } from "../src/themes/tokens.js";

// WCAG 2.2 1.4.11 (non-text contrast): the visual cue of a control or a state needs 3:1 against what it touches.
// Computed from BASE_CSS's own declarations and each theme's tokens, so a rule that drops below 3:1 fails here.

beforeAll(() => loadLeague("nfl").then(() => undefined)); // sdvTeam resolves KC

const S = "#t";
/** Every `selector{body}` rule of a stylesheet, selector without the `#t ` scope. */
const rules = (css: string): { sel: string; body: string }[] =>
  Array.from(css.matchAll(/([^{}]+)\{([^}]*)\}/g), (m) => ({
    sel: (m[1] as string).trim().replace(`${S} `, ""),
    body: m[2] as string,
  }));
/** The values `prop` takes in the rule for `sel`, in source order (a fallback first, its override after). */
const decls = (sel: string, prop: string): string[] =>
  rules(BASE_CSS(S))
    .filter((r) => r.sel === sel)
    .flatMap((r) => r.body.split(/;(?![^(]*\))/))
    .map((d) => d.trim())
    .filter((d) => d.startsWith(`${prop}:`))
    .map((d) => d.slice(prop.length + 1));
/** Top-level comma split (commas inside rgba(...) / color-mix(...) stay). */
const layers = (v: string): string[] => v.split(/,(?![^(]*\))/).map((x) => x.trim());

/** A CSS color expression over the theme's tokens: a hex, var(--sdvt-*), or color-mix(in srgb, A p%, B). */
function color(expr: string, t: ThemeTokens): string {
  const e = expr.trim();
  const v = e.match(/^var\(--sdvt-([a-z-]+)\)$/);
  if (v)
    return color(
      t[(v[1] as string).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof ThemeTokens],
      t,
    );
  const m = e.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*(.+)\)$/);
  if (m) return mix(color(m[3] as string, t), color(m[1] as string, t), Number(m[2]) / 100);
  if (/^#[0-9a-f]{3,8}$/i.test(e)) return e;
  throw new Error(`no color for ${expr}`);
}
/** rgba(r,g,b,a) composited over `under`. */
function over(rgba: string, under: string): string {
  const [r, g, b, a] = (rgba.match(/[\d.]+/g) as string[]).map(Number) as [number, number, number, number];
  const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  return mix(under, hex, a);
}

/** The backgrounds a body cell can have: the table's, the stripe's, and any td fill a theme's own rules paint. */
function cellBackgrounds(th: Theme): string[] {
  const t = th.tokens;
  const fills = rules(th.rules(S))
    .filter((r) => /\btd\b/.test(r.sel))
    .flatMap((r) =>
      Array.from(r.body.matchAll(/background(?:-color)?:\s*(#[0-9a-f]{3,8})/gi), (m) => m[1] as string),
    );
  return [t.bg, ...(t.stripe === "transparent" ? [] : [t.stripe]), ...fills];
}

/** The filter boxes' border against the box and the toolbar around it (both the table background). */
function inputBorder(t: ThemeTokens): number {
  const colors = [
    ...decls(".sdvt-toolbar input", "border").map((v) => v.replace(/^\S+\s+\S+\s+/, "")), // "1px solid <color>"
    ...decls(".sdvt-toolbar input", "border-color"),
  ];
  return Math.min(...colors.map((c) => contrast(color(c, t), t.bg)));
}

/**
 * The selected row's cue against what it touches. A translucent full-cell overlay is judged as the selected cell
 * against an unselected one; a solid bar (an inset shadow with an offset) against the selected cell beside it and
 * the table background at the row's edge. The best cue counts: one cue at 3:1 is enough.
 */
function selectedCue(th: Theme): number {
  const t = th.tokens;
  const cells = cellBackgrounds(th);
  const shadows = ["tr.sdvt-selected>td", "tr.sdvt-selected>td:first-child"].flatMap((sel) =>
    decls(sel, "box-shadow").flatMap(layers),
  );
  const overlay = shadows.find((l) => /9999px/.test(l))?.match(/rgba\([^)]*\)/)?.[0];
  if (!overlay) throw new Error("the selected-row overlay is gone");
  const scores = shadows.map((l) => {
    if (l === shadows.find((x) => /9999px/.test(x)))
      return Math.min(...cells.map((c) => contrast(over(overlay, c), c)));
    const bar = l.match(/^inset\s+(-?\d+)(?:px)?\s+(-?\d+)(?:px)?\s+0\s+(.+)$/);
    if (!bar || (bar[1] === "0" && bar[2] === "0")) return 0;
    const ink = color(bar[3] as string, t);
    return Math.min(contrast(ink, t.bg), ...cells.map((c) => contrast(ink, over(overlay, c))));
  });
  return Math.max(...scores);
}

/**
 * The hovered row's cue (J31, A29: a linked figure's hover lights the row): a solid bar drawn as a background image,
 * judged against every cell background it can sit on, a selected cell's overlay included (a row can be both).
 */
function hoverCue(th: Theme): number {
  const bar = decls("tr.sdvt-hover>td.sdvt-cell", "background-image")[0]?.match(
    /^linear-gradient\((.*)\)$/,
  )?.[1];
  if (bar === undefined) throw new Error("the hovered-row bar is gone");
  const ink = color(layers(bar)[0] as string, th.tokens);
  const overlay = decls("tr.sdvt-selected>td", "box-shadow")
    .flatMap(layers)
    .find((l) => /9999px/.test(l))
    ?.match(/rgba\([^)]*\)/)?.[0];
  const cells = cellBackgrounds(th);
  const under = overlay === undefined ? cells : [...cells, ...cells.map((c) => over(overlay, c))];
  return Math.min(...under.map((c) => contrast(ink, c)));
}

const themes = (): [string, Theme][] => [
  ...THEME_NAMES.map((name): [string, Theme] => [
    name,
    resolveTheme({
      name,
      density: "comfortable",
      ...(name === "sdvTeam" ? { options: { league: "nfl", team: "KC" } } : {}),
    }),
  ]),
  ["sdv (dark)", resolveTheme({ name: "sdv", density: "comfortable", options: { style: "dark" } })],
];

test("I4: the filter boxes' border reaches 3:1 against the table background in every theme", () => {
  const ratios = themes().map(
    ([name, th]) => [name, Math.round(inputBorder(th.tokens) * 100) / 100] as const,
  );
  expect(ratios.filter(([, r]) => r < 3)).toEqual([]);
});

test("I4: the selected row has a cue at 3:1 against what it touches in every theme", () => {
  const ratios = themes().map(([name, th]) => [name, Math.round(selectedCue(th) * 100) / 100] as const);
  expect(ratios.filter(([, r]) => r < 3)).toEqual([]);
});

test("A29: the hovered row has a cue at 3:1 against what it touches in every theme, selected or not", () => {
  const ratios = themes().map(([name, th]) => [name, Math.round(hoverCue(th) * 100) / 100] as const);
  expect(ratios.filter(([, r]) => r < 3)).toEqual([]);
});
