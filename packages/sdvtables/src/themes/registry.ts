// src/themes/registry.ts — the surveyed table-style registry (data/table_themes.json) as sdvtables themes
import reg from "../../data/table_themes.json" with { type: "json" };
import { TableSpecError } from "../errors.js";
import type { ThemeRef } from "../spec.js";
import {
  type GoogleFont,
  type Theme,
  type ThemeTokens,
  baseTokens,
  densitySizes,
  fontStack,
} from "./tokens.js";

type Palette = Readonly<Record<string, string | null | undefined>>;
interface RegistrySpec {
  readonly source: string;
  readonly category: string;
  readonly darkPolicy: string;
  readonly fonts: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly light: Palette;
  readonly dark: Palette | null;
  readonly structure: Readonly<Record<string, unknown>>;
}
const SPECS = reg.themes as unknown as Readonly<Record<string, RegistrySpec>>;

// Fallbacks for palette keys a spec omits: shoot.py PALETTE_DEFAULTS plus its dark override block.
const DEFAULTS: Record<string, string> = {
  bg: "#ffffff",
  text: "#222222",
  muted: "#666666",
  accent: "#c70000",
  rule: "#222222",
  hline: "#e5e5e5",
  stripe: "#f5f5f5",
  summaryBg: "#f0f0f0",
  link: "#1a5fb4",
  pos: "#17692f",
  neg: "#a1231b",
  posBg: "#e3f3e6",
  negBg: "#fbe5e4",
  heatLow: "#f8696b",
  heatMid: "#fcfcff",
  heatHigh: "#63be7b",
};
const DARK_DEFAULTS: Record<string, string> = {
  text: "#e8e8e8",
  muted: "#a0a6ad",
  rule: "#e8e8e8",
  hline: "#2c3138",
  stripe: "#1c2026",
  summaryBg: "#2a2f36",
  link: "#8ab4f8",
  pos: "#5fd08a",
  neg: "#ff8a80",
  posBg: "#123522",
  negBg: "#3d1614",
  bg: "#14171c",
};

function palette(spec: RegistrySpec, mode: "light" | "dark"): Record<string, string> {
  const p: Record<string, string> = { ...DEFAULTS, ...(mode === "dark" ? DARK_DEFAULTS : {}) };
  for (const [k, v] of Object.entries((mode === "dark" ? spec.dark : spec.light) ?? {})) if (v) p[k] = v;
  p.page ||= p.bg as string;
  p.labelBg ||= p.bg as string;
  p.labelColor ||= p.muted as string;
  return p;
}

/** Substitute `{key}` from the palette; a key the palette lacks becomes mid-grey, never a literal `{key}`. */
const sub = (css: unknown, p: Record<string, string>): string =>
  typeof css === "string" && css ? css.replace(/\{(\w+)\}/g, (_, k: string) => p[k] ?? "#888888") : "none";

function fontsOf(spec: RegistrySpec): GoogleFont[] {
  const f = spec.fonts;
  const faces = new Map<string, { w: Set<number>; italic: boolean }>();
  for (const role of ["title", "label", "body", "numeric", "subtitle"]) {
    const fam = f[role];
    if (typeof fam !== "string" || !fam) continue;
    const e = faces.get(fam) ?? { w: new Set<number>([400]), italic: false };
    const w = f[`${role}Weight`];
    if (typeof w === "number") e.w.add(w);
    if (role === "subtitle" && f.subtitleItalic === true) e.italic = true;
    faces.set(fam, e);
  }
  return [...faces].map(([family, e]) => ({
    family,
    weights: [...e.w].sort((a, b) => a - b),
    ...(e.italic ? { italic: true } : {}),
  }));
}

/** The 3 sorted ids of dark-capable registry themes sharing `category`, for the light-only error. */
const darkAlternatives = (category: string): string[] =>
  Object.keys(SPECS)
    .filter((id) => SPECS[id]?.category === category && SPECS[id]?.darkPolicy !== "none")
    .sort()
    .slice(0, 3);

/** Whether `name` is a registry theme id. */
export const isRegistryTheme = (name: string): boolean => Object.hasOwn(SPECS, name);

/**
 * Resolve a surveyed registry theme (e.g. `datagolf`, `wikipedia`, `nejm`) by its source name.
 *
 * @param ref - theme name, density, and `options.mode` (`"light"` default, or `"dark"`).
 * @returns the {@link Theme}; structure features with no token (heat, delta, spanners ...) are ignored here.
 * @throws TableSpecError for an unknown name, or `mode: "dark"` on a light-only theme.
 */
export function registryTheme(ref: ThemeRef): Theme {
  const spec = Object.hasOwn(SPECS, ref.name) ? SPECS[ref.name] : undefined;
  if (!spec) throw new TableSpecError(`unknown registry theme "${ref.name}"`);
  const mode = ref.options?.mode ?? "light";
  if (mode !== "light" && mode !== "dark")
    throw new TableSpecError(`mode must be "light" or "dark", not "${mode}"`);
  if (mode === "dark" && (spec.darkPolicy === "none" || !spec.dark)) {
    throw new TableSpecError(
      `theme "${ref.name}" is light-only; dark-capable themes in category "${spec.category}": ${darkAlternatives(spec.category).join(", ")}`,
    );
  }
  const p = palette(spec, mode);
  const st = spec.structure;
  const d = densitySizes(ref.density);
  const fam = (k: string) => fontStack(String(spec.fonts[k] ?? spec.fonts.body ?? "Inter"));
  const tokens: ThemeTokens = {
    ...baseTokens(d, fam("body")),
    fontTitle: fam("title"),
    fontLabel: fam("label"),
    bg: p.bg as string,
    text: p.text as string,
    muted: p.muted as string,
    accent: p.accent as string,
    rule: p.rule as string,
    hline: sub(st.rowRule, p),
    labelBg: p.labelBg as string,
    labelColor: p.labelColor as string,
    labelBorderTop: sub(st.labelBorderTop, p),
    labelBorderBottom: sub(st.labelBorderBottom, p),
    tableBorderTop: sub(st.tableBorderTop, p),
    tableBorderBottom: sub(st.tableBorderBottom, p),
    tableBorderX: sub(st.frame, p),
    headingAlign: st.headingAlign === "center" ? "center" : "left",
    titleTransform: String(st.titleTransform ?? "none"),
    labelTransform: String(st.labelTransform ?? "none"),
    labelTracking: String(st.labelTracking ?? "normal"),
    ...(st.stripe === true ? { stripe: p.stripe as string } : {}),
  };
  return { name: ref.name, tokens, fonts: fontsOf(spec), rules: () => "" };
}

/** List registry themes, optionally only those usable in `mode` (non-`none` darkPolicy for dark) or in a `category`. */
export function listTableThemes(filter?: { mode?: "light" | "dark"; category?: string }): {
  id: string;
  source: string;
  category: string;
  darkPolicy: string;
}[] {
  return Object.entries(SPECS)
    .filter(([, s]) => !(filter?.mode === "dark" && s.darkPolicy === "none"))
    .filter(([, s]) => !filter?.category || s.category === filter.category)
    .map(([id, s]) => ({ id, source: s.source, category: s.category, darkPolicy: s.darkPolicy }));
}
