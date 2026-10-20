import type { VictoryGroupProps, VictoryThemeDefinition } from "victory";
import { VictoryTheme } from "victory";
import { expectTypeOf, test } from "vitest";
import { teamColorPalette, teamTheme } from "../src/victory.js";

test("teamTheme is a Victory theme, over a Victory theme; teamColorPalette is a colorScale", () => {
  expectTypeOf(teamTheme({ league: "nfl", teams: ["KC"] })).toMatchTypeOf<VictoryThemeDefinition>();
  const over = teamTheme({ league: "nfl", teams: ["KC"], base: VictoryTheme.clean });
  expectTypeOf(over).toMatchTypeOf<VictoryThemeDefinition>();
  expectTypeOf(over.axis).toEqualTypeOf(VictoryTheme.clean.axis); // the base's other keys keep their types
  expectTypeOf(teamColorPalette("nfl", ["KC"])).toMatchTypeOf<VictoryGroupProps["colorScale"]>();
});
