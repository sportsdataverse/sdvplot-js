// test/cells-iconAssign.test.ts — reactablefmtr icon_assign: one icon per unit to the column max, or by bucket.
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { renderHTML } from "../src/html/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
const cellOf = (html: string, key: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?<td[^>]*data-col="${key}"[^>]*>(.*?)</td>`, "s").exec(html)?.[1] ?? "";
const count = (s: string, fill: string): number => s.split(`fill="${fill}"`).length - 1;

test("one icon per unit up to the column max: filled to the value in #15607A, the rest #EEEEEE, titled 'v out of max'", () => {
  const rows = STANDINGS.map((r) => ({ ...r, playoff_wins: { KC: 3, BUF: 2, DEN: 0, LAC: 0 }[r.team] ?? 0 }));
  const out = renderHTML(
    defineTable<(typeof rows)[number]>()
      .columns((c) => [c.iconAssign("playoff_wins")])
      .build(),
    rows,
    { css: "none" },
  );
  const kc = cellOf(out, "playoff_wins");
  expect(kc).toMatch(/^<span title="3 out of 3" aria-label="3 out of 3" role="img"><svg /);
  expect(count(kc, "#15607A")).toBe(3);
  const buf = cellOf(out, "playoff_wins", 4);
  expect([count(buf, "#15607A"), count(buf, "#EEEEEE")]).toEqual([2, 1]);
  expect(count(cellOf(out, "playoff_wins", 1), "#EEEEEE")).toBe(3);
  expect(out).toContain('class="sdvt-cell sdvt-kind-iconAssign sdvt-left"');
});

test("buckets: the value's ntile out of n; seqBy; showValues; opacities; a max of 0 draws one empty icon", () => {
  const out = renderHTML(
    defineTable<Standing>()
      .columns((c) => [
        c.iconAssign("wins", { buckets: 4, icon: "star", fill: "#D6AF36", showValues: "right" }),
        c.iconAssign("losses", { seqBy: 5, emptyOpacity: 0.5, showValues: "left" }),
        c.iconAssign("ties"),
      ])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  const kc = cellOf(out, "wins"); // 15 wins: the top quarter
  expect(kc).toMatch(/title="4 out of 4"/);
  expect(count(kc, "#D6AF36")).toBe(4);
  expect(kc).toMatch(/<\/span><span style="margin-left:6px">15<\/span>$/);
  const lv = cellOf(out, "losses", 3); // 13 losses; icons at 1, 6, 11 -> all three filled
  expect(lv).toMatch(/^<span style="margin-right:6px">13<\/span><span title="13 out of 13"/);
  expect(count(lv, "#15607A")).toBe(3);
  expect(count(cellOf(out, "losses"), "#eeeeee80")).toBe(2); // KC: 2 losses fills only the icon at 1
  expect(count(cellOf(out, "ties"), "#EEEEEE")).toBe(1);
  expect(() =>
    renderHTML(
      defineTable<Standing>()
        .columns((c) => [c.iconAssign("pf")])
        .build(),
      STANDINGS,
    ),
  ).not.toThrow();
  expect(() =>
    renderHTML(
      defineTable<Standing>()
        .columns((c) => [c.iconAssign("wins", { fillOpacity: 2 })])
        .build(),
      STANDINGS,
    ),
  ).toThrow(/between 0 and 1/);
});
