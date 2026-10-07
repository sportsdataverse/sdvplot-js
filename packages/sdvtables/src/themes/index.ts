import { TableSpecError } from "../errors.js";
import type { ThemeRef } from "../spec.js";
import { almanac } from "./almanac.js";
import { athletic } from "./athletic.js";
import { booktabs } from "./booktabs.js";
import { broadsheet } from "./broadsheet.js";
import { brutalist } from "./brutalist.js";
import { drench } from "./drench.js";
import { gtutils } from "./gtutils.js";
import { kenpom } from "./kenpom.js";
import { midnight } from "./midnight.js";
import { ncaa } from "./ncaa.js";
import { pl } from "./pl.js";
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
};
export const THEME_NAMES: readonly string[] = Object.keys(THEMES);
export function resolveTheme(ref: ThemeRef): Theme {
  const def = THEMES[ref.name];
  if (!def) throw new TableSpecError(`unknown theme "${ref.name}"; one of ${THEME_NAMES.join(", ")}`);
  return def(ref);
}
export type { Theme, ThemeTokens, GoogleFont, ThemeDef } from "./tokens.js";
