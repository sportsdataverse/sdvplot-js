import { PAL_MIDNIGHT, THEMES, THEME_NAMES, TOKEN_KEYS, resolveTheme } from "@sportsdataverse/sdvtables";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The theme registry: names, definitions, tokens",
  tags: ["theme", "THEMES", "THEME_NAMES", "resolveTheme", "TOKEN_KEYS", "PAL_MIDNIGHT"],
} satisfies ExampleMeta;

// A theme is a function of { name, density, options } (THEMES[name]); resolveTheme picks and calls it.
// Its tokens (TOKEN_KEYS) become CSS custom properties on the table.
const midnight = resolveTheme({ name: "midnight", density: "comfortable" });
const { bg, text, muted, accent, rule, stripe } = midnight.tokens;

export default {
  THEME_NAMES,
  "THEMES.midnight is a function": typeof THEMES.midnight === "function",
  "TOKEN_KEYS.length": TOKEN_KEYS.length,
  "midnight colour tokens": { bg, text, muted, accent, rule, stripe },
  "midnight fonts": midnight.fonts.map((f) => f.family),
  PAL_MIDNIGHT,
};
