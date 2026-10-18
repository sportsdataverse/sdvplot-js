import { TableSpecError } from "../errors.js";
import type { ThemeRef } from "../spec.js";
import { almanac } from "./almanac.js";
import { athletic } from "./athletic.js";
import { booktabs } from "./booktabs.js";
import { broadsheet } from "./broadsheet.js";
import { brutalist } from "./brutalist.js";
import { drench } from "./drench.js";
import { FMTR_THEMES, fmtrTeam } from "./fmtr.js";
import { gtutils } from "./gtutils.js";
import { kenpom } from "./kenpom.js";
import { midnight } from "./midnight.js";
import { ncaa } from "./ncaa.js";
import { pl } from "./pl.js";
import { isRegistryTheme, listTableThemes, registryTheme } from "./registry.js";
import { savant } from "./savant.js";
import { scoreboard } from "./scoreboard.js";
import { sdv, sdvTeam } from "./sdv.js";
import { sofa } from "./sofa.js";
import { swiss } from "./swiss.js";
import { terminal } from "./terminal.js";
import { tier } from "./tier.js";
import type { Theme, ThemeDef } from "./tokens.js";
import { tufte } from "./tufte.js";
export const THEMES: Readonly<Record<string, ThemeDef>> = {
  sdv,
  sdvTeam,
  almanac,
  athletic,
  booktabs,
  broadsheet,
  brutalist,
  drench,
  gtutils,
  kenpom,
  midnight,
  ncaa,
  pl,
  savant,
  scoreboard,
  sofa,
  swiss,
  terminal,
  tier,
  tufte,
  ...FMTR_THEMES, // the 27 reactablefmtr themes, fmtr-<name>
  "fmtr-team": fmtrTeam,
};
export const THEME_NAMES: readonly string[] = Object.keys(THEMES);
export function resolveTheme(ref: ThemeRef): Theme {
  const def = THEMES[ref.name];
  if (!def && isRegistryTheme(ref.name)) return registryTheme(ref);
  if (!def) {
    const ids = listTableThemes().map((t) => t.id);
    const close = closeMatches(ref.name, [...THEME_NAMES, ...ids]);
    const hint = close.length ? `; did you mean ${close.map((c) => `"${c}"`).join(", ")}?` : "";
    throw new TableSpecError(
      `unknown theme "${ref.name}"${hint} (house and fmtr themes: THEME_NAMES; the ${ids.length} registry themes: listTableThemes())`,
    );
  }
  return def(ref);
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
// up to 3 names within edit distance max(2, length/3), closest first (ties by name)
function closeMatches(name: string, names: readonly string[]): string[] {
  const lim = Math.max(2, Math.floor(name.length / 3));
  return names
    .map((n) => [n, editDistance(name.toLowerCase(), n.toLowerCase())] as const)
    .filter(([, d]) => d <= lim)
    .sort((x, y) => x[1] - y[1] || x[0].localeCompare(y[0]))
    .slice(0, 3)
    .map(([n]) => n);
}
export type { Theme, ThemeTokens, GoogleFont, ThemeDef } from "./tokens.js";
/** The 27 reactablefmtr themes' sdvtables names (`fmtr-cerulean` ... `fmtr-void`), for `themePreview`. */
export const FMTR_THEME_NAMES: readonly string[] = Object.keys(FMTR_THEMES);
