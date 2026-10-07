import { TableSpecError } from "../errors.js";
import type { ThemeRef } from "../spec.js";
import { sdv, sdvTeam } from "./sdv.js";
import type { Theme, ThemeDef } from "./tokens.js";
export const THEMES: Readonly<Record<string, ThemeDef>> = { sdv, sdvTeam };
export const THEME_NAMES: readonly string[] = Object.keys(THEMES);
export function resolveTheme(ref: ThemeRef): Theme {
  const def = THEMES[ref.name];
  if (!def) throw new TableSpecError(`unknown theme "${ref.name}"; one of ${THEME_NAMES.join(", ")}`);
  return def(ref);
}
export type { Theme, ThemeTokens, GoogleFont, ThemeDef } from "./tokens.js";
