/** The package version, injected from package.json at build time. */
export const VERSION: string = __SDVTABLES_VERSION__;
// The renderer, themePreview, styleSheet and prepare live under ./html.
export type * from "./spec.js";
export { TableSpecError } from "./errors.js";
export { type ColumnFactory, RANK_PALETTE, TableBuilder, columnFactory, defineTable } from "./define.js";
export { matches, selectRows } from "./predicate.js";
export { snakeAlign } from "./snake.js";
export { THEMES, THEME_NAMES, resolveTheme } from "./themes/index.js";
export type { GoogleFont, Theme, ThemeDef, ThemeTokens } from "./themes/index.js";
export { DENSITY, TOKEN_KEYS } from "./themes/tokens.js";
export { secondaryOn } from "./themes/sdv.js";
export { type Alias, GT_ALIASES, PAL_MIDNIGHT, aliasFor } from "./aliases.js";
