// test/cells-bubble.test.ts — reactablefmtr bubble_grid: size |v| / max|v| * 100px, colour on the column's ramp.
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { prepare, renderHTML } from "../src/html/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
const cellOf = (html: string, key: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?<td[^>]*data-col="${key}"[^>]*>(.*?)</td>`, "s").exec(html)?.[1] ?? "";

test("defaults: a circle |v| / max|v| * 100px across on #15607A -> #FFFFFF -> #FA8C00, the value inside in contrast ink", () => {
  const out = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.bubble("pa")])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(cellOf(out, "pa", 3)).toBe(
    '<div style="background:#fa8c00;color:#000000;display:inline-flex;justify-content:center;align-items:center;text-align:center;height:100px;width:100px;border-radius:50%">434</div>',
  ); // LV 434 is the max
  expect(cellOf(out, "pa", 1)).toContain("background:#15607a;color:#ffffff"); // LAC 301 is the min
  expect(cellOf(out, "pa")).toContain("height:75.12px;width:75.12px"); // KC 326 / 434
  expect(out).toContain('class="sdvt-cell sdvt-kind-bubble sdvt-center"');
});

test("squares, maxSize, opacity, showText false, min/max, colorRef / team, blank values", async () => {
  const out = renderHTML(
    defineTable<Standing>()
      .columns((c) => [
        c.bubble("wins", {
          shape: "squares",
          maxSize: 40,
          opacity: 0.5,
          showText: false,
          minValue: 0,
          maxValue: 20,
        }),
        c.bubble("net_epa", { colors: ["#ffffff"] }),
      ])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  const kc = cellOf(out, "wins"); // (15 - 0) / (20 - 0) * 40
  expect(kc).toContain("color:transparent");
  expect(kc).toContain("height:30px;width:30px");
  expect(kc).not.toContain("border-radius");
  expect(kc).toMatch(/background:#[0-9a-f]{6}80/);
  expect(cellOf(out, "net_epa", 7)).toBe("");
  const team = defineTable<Standing>()
    .columns((c) => [c.bubble("wins", { team: "team", league: "nfl", which: "secondary" })])
    .build();
  await prepare(team);
  expect(cellOf(renderHTML(team, STANDINGS, { css: "none" }), "wins")).toContain("background:#ffb612"); // KC gold
});
