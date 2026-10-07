import { SdvplotError } from "@sportsdataverse/sdvplot";
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { TableSpecError } from "../src/errors.js";
import type { Standing } from "./fixtures/standings.js";
test("builder produces plain serializable data with reserved fields untouched", () => {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.logo("team", { league: "nfl", includeName: true }),
      c.num("net_epa", { digits: 3, sortable: true }),
      c.pct("wins", { digits: 0 }),
    ])
    .theme("midnight", { density: "compact" })
    .title("AFC")
    .subtitle("2024")
    .groupBy("division")
    .groupStripes({ color: "#1b1e26" })
    .build();
  expect(spec.columns[0]).toEqual({
    kind: "logo",
    key: "team",
    league: "nfl",
    includeName: true,
    height: 30,
  });
  expect(spec.columns[1]).toMatchObject({ kind: "num", key: "net_epa", digits: 3, sortable: true });
  expect(spec.theme).toEqual({ name: "midnight", density: "compact" });
  expect(spec.decorations).toEqual([
    { type: "title", text: "AFC" },
    { type: "subtitle", text: "2024" },
    { type: "groupBy", key: "division" },
    { type: "groupStripes", color: "#1b1e26", start: 2 },
  ]);
  expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
  // a theme's own default density (Python: almanac/scoreboard/terminal default to compact) unless one is given
  expect(
    defineTable<Standing>()
      .columns((c) => [c.text("team")])
      .theme("terminal")
      .build().theme,
  ).toEqual({ name: "terminal", density: "compact" });
  expect(
    defineTable<Standing>()
      .columns((c) => [c.text("team")])
      .theme("kenpom")
      .build().theme.density,
  ).toBe("comfortable");
});
test("duplicate column key and empty columns are TableSpecError, an SdvplotError", () => {
  expect(() =>
    defineTable<Standing>()
      .columns((c) => [c.text("team"), c.text("team")])
      .build(),
  ).toThrow(TableSpecError);
  expect(() => defineTable<Standing>().build()).toThrow(/at least one column/);
  const e = new TableSpecError("x");
  expect(e).toBeInstanceOf(SdvplotError);
  expect(e.name).toBe("TableSpecError");
});
