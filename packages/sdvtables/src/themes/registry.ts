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
  readonly sizes: TableThemeSpec["sizes"];
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
  typeof css === "string" && css
    ? css.replace(/\{(\w+)\}/g, (_, k: string) => (Object.hasOwn(p, k) && p[k]) || "#888888")
    : "none";

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

/** Spec font weights as token strings; a weight the spec omits keeps the baseTokens default. */
function weights(spec: RegistrySpec): Partial<ThemeTokens> {
  const w = (k: string) => (typeof spec.fonts[k] === "number" ? String(spec.fonts[k]) : undefined);
  const out: Partial<ThemeTokens> = {};
  const t = w("titleWeight");
  const l = w("labelWeight");
  const b = w("bodyWeight");
  if (t) out.titleWeight = t;
  if (l) out.labelWeight = l;
  if (b) out.bodyWeight = b;
  return out;
}

/** Why a light-only theme has no dark mode: 3 sorted dark-capable ids in its category, else 3 from any category. */
function darkAdvice(category: string): string {
  const dark = Object.keys(SPECS)
    .filter((id) => SPECS[id]?.darkPolicy !== "none")
    .sort();
  const same = dark.filter((id) => SPECS[id]?.category === category).slice(0, 3);
  return same.length
    ? `dark-capable themes in category "${category}": ${same.join(", ")}`
    : `no dark-capable themes in category "${category}"; try: ${dark.slice(0, 3).join(", ")}`;
}

/** Whether `name` is a registry theme id. */
// The CSS generic family a face falls back to, guessed from its name: the same rule as sdvplot
// `_generic_family` and sdvplotR `.tt_generic_family`; keep the three regexes identical.
const MONO = /mono|code|courier/i;
const SERIF =
  /serif|slab|bodoni|caslon|garamond|playfair|lora|newsreader|tinos|spectral|gelasio|merriweather|crimson|fraunces/i;
const genericFamily = (family: string): "monospace" | "serif" | "sans-serif" =>
  MONO.test(family) ? "monospace" : SERIF.test(family) && !/sans/i.test(family) ? "serif" : "sans-serif";
// serif and mono faces fall back to their generic; sans faces keep the house system stack (ends in sans-serif)
const registryFontStack = (family: string): string => {
  const g = genericFamily(family);
  return g === "sans-serif" ? fontStack(family) : `'${family}', ${g}`;
};

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
    throw new TableSpecError(`theme "${ref.name}" is light-only; ${darkAdvice(spec.category)}`);
  }
  const p = palette(spec, mode);
  const st = spec.structure;
  const d = densitySizes(ref.density);
  const fam = (k: string) => registryFontStack(String(spec.fonts[k] ?? spec.fonts.body ?? "Inter"));
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
    tableBorderX: sub(st.frame, p), // colRule has no token (engine gap G2); the left/right frame is the closest
    ...weights(spec),
    headingAlign: st.headingAlign === "center" ? "center" : "left",
    titleTransform: String(st.titleTransform ?? "none"),
    labelTransform: String(st.labelTransform ?? "none"),
    labelTracking: String(st.labelTracking ?? "normal"),
    ...(st.stripe === true ? { stripe: p.stripe as string } : {}),
  };
  return { name: ref.name, tokens, fonts: fontsOf(spec), rules: () => "" };
}

// Levenshtein distance, for the unknown-theme suggestions
function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    prev = cur;
  }
  return prev[b.length] ?? 0;
}
/** Up to 3 names within edit distance max(2, length/3), closest first (ties by name): the unknown-theme suggestions. */
export function closeMatches(name: string, names: readonly string[]): string[] {
  const lim = Math.max(2, Math.floor(name.length / 3));
  return names
    .map((n) => [n, editDistance(name.toLowerCase(), n.toLowerCase())] as const)
    .filter(([, d]) => d <= lim)
    .sort((x, y) => x[1] - y[1] || x[0].localeCompare(y[0]))
    .slice(0, 3)
    .map(([n]) => n);
}

/** The keys of a resolved registry palette: each a `#rrggbb` colour. */
export type TableThemePaletteKey =
  | "page"
  | "bg"
  | "text"
  | "muted"
  | "accent"
  | "rule"
  | "hline"
  | "labelBg"
  | "labelColor"
  | "stripe"
  | "summaryBg"
  | "link"
  | "pos"
  | "neg"
  | "posBg"
  | "negBg"
  | "heatLow"
  | "heatMid"
  | "heatHigh";

/**
 * One registry theme resolved in one mode, as Python's `table_theme_spec` returns it (its `TableThemeSpec`, with
 * `dark_policy` as `darkPolicy`): the surveyed fonts and sizes, the palette complete (a key the theme omits takes the
 * shared default), and the structure with every `{key}` in its border strings taken from the palette.
 */
export interface TableThemeSpec {
  /** The registry id, e.g. "datagolf". */
  readonly id: string;
  /** The surveyed source's name, e.g. "DataGolf". */
  readonly source: string;
  /** "journal", "library", "finance", "news", "sports", "gov" or "periodical". */
  readonly category: string;
  /** The faces (Google Fonts families) and their weights. */
  readonly fonts: {
    readonly title: string;
    readonly titleWeight: number;
    readonly label: string;
    readonly labelWeight: number;
    readonly body: string;
    readonly bodyWeight: number;
    readonly numeric: string;
    readonly subtitle: string;
    readonly subtitleItalic: boolean;
  };
  /** Font sizes and cell padding, in px. */
  readonly sizes: {
    readonly title: number;
    readonly subtitle: number;
    readonly label: number;
    readonly body: number;
    readonly source: number;
    readonly padY: number;
    readonly padX: number;
  };
  /** The mode's colours, complete: a key the theme omits takes the shared default. */
  readonly palette: Readonly<Record<TableThemePaletteKey, string>>;
  /** Rules, borders, stripes, heat and the rest, as the registry has them, border strings substituted. */
  readonly structure: Readonly<Record<string, unknown>>;
  /** "native" (the site has a dark mode), "derived" (sdv's own dark palette) or "none" (light only). */
  readonly darkPolicy: string;
}

// reactablefmtr's own themes: sdvtables' fmtr-<name>, not registry ids (the surveyed sites are <name>-site)
const FMTR_PORTS: readonly string[] = ["espn", "fivethirtyeight", "pff"];

/**
 * Resolve a surveyed registry theme (e.g. `datagolf`, `wikipedia`, `nejm`) to its fonts, sizes, palette and structure,
 * as Python's `table_theme_spec` does. Pass it, resolved in the same `mode`, as `perspectiveConfig`'s `theme`
 * (`@sportsdataverse/sdvplot/perspective`).
 *
 * @param name - the theme id, as `listTableThemes()` lists it. "espn", "fivethirtyeight" and "pff" are reactablefmtr
 *   ports (the `fmtr-espn` theme and so on), not registry ids; the surveyed look of those sites is "espn-site" and so on.
 * @param mode - "light" (default) or "dark".
 * @returns a new spec on every call: changing one changes no other.
 * @throws TableSpecError for an unknown `mode`, an unknown name (with up to 3 close matches), a reactablefmtr name, or
 *   "dark" on a light-only theme (naming three dark-capable themes in its category).
 *
 * @example
 * ```ts
 * import { tableThemeSpec } from "@sportsdataverse/sdvtables";
 *
 * const spec = tableThemeSpec("datagolf", "dark");
 * [spec.palette.bg, spec.fonts.body, spec.sizes.body];
 * ```
 */
export function tableThemeSpec(name: string, mode: "light" | "dark" = "light"): TableThemeSpec {
  if (mode !== "light" && mode !== "dark")
    throw new TableSpecError(`mode must be "light" or "dark", not "${String(mode)}"`);
  const s = Object.hasOwn(SPECS, name) ? SPECS[name] : undefined;
  if (!s) {
    if (FMTR_PORTS.includes(name))
      throw new TableSpecError(
        `"${name}" is a reactablefmtr port, not a registry theme: use the "fmtr-${name}" theme, or "${name}-site" for the surveyed site look`,
      );
    const close = closeMatches(name, Object.keys(SPECS));
    const hint = close.length ? `; did you mean ${close.map((c) => `"${c}"`).join(", ")}?` : "";
    throw new TableSpecError(`unknown table theme "${name}"${hint} (see listTableThemes())`);
  }
  if (mode === "dark" && (s.darkPolicy === "none" || !s.dark))
    throw new TableSpecError(`theme "${name}" is light-only; ${darkAdvice(s.category)}`);
  const p = palette(s, mode);
  return {
    id: name,
    source: s.source,
    category: s.category,
    fonts: structuredClone(s.fonts) as TableThemeSpec["fonts"],
    sizes: structuredClone(s.sizes),
    palette: p as Record<TableThemePaletteKey, string>,
    // every `{key}` sits in a border string; the rest (heatColumns ...) is copied, so the registry stays as loaded
    structure: Object.fromEntries(
      Object.entries(s.structure).map(([k, v]) => [
        k,
        typeof v === "string" ? sub(v, p) : structuredClone(v),
      ]),
    ),
    darkPolicy: s.darkPolicy,
  };
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
