import { setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { renderHTML, themePreview } from "../src/html/index.js";
import { snakeAlign } from "../src/snake.js";
import { THEME_NAMES } from "../src/themes/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
beforeAll(() => setWarningHandler(() => {}));
test("snakeAlign = Python _snake_shape: nCols blocks, or ceil(n / rowsPerCol) blocks; snake renders two header runs and a gap column", () => {
  expect(snakeAlign([1, 2, 3, 4, 5], { nCols: 2 })).toEqual([
    [1, 2, 3],
    [4, 5, null],
  ]);
  expect(snakeAlign([1, 2, 3, 4], { nCols: 2, rowsPerCol: 3 })).toEqual([
    [1, 2, 3],
    [4, null, null],
  ]);
  expect(snakeAlign([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { nCols: 2, rowsPerCol: 3 })).toHaveLength(4); // rowsPerCol wins: no row dropped
  expect(snakeAlign([1, 2, 3], { nCols: 2, fill: 0 })).toEqual([
    [1, 2],
    [3, 0],
  ]);
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.text("team"), c.int("wins")])
      .snake({ nCols: 2 })
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(html.match(/data-col="team" data-kind="text"/g)?.length).toBe(2);
  expect(html.match(/<tr class="sdvt-row"/g)?.length).toBe(4);
  expect(html).toMatch(
    /data-row="0"[^>]*>.*?>KC<.*?<td class="sdvt-gap" style="width:20px;border:none"><\/td>.*?>BUF</s,
  );
  expect(() =>
    renderHTML(
      defineTable<Standing>()
        .columns((c) => [c.text("team")])
        .snake()
        .groupBy("division")
        .build(),
      STANDINGS,
    ),
  ).toThrow(/snake.*groupBy/);
});
test("tiers: tier label filled by level color, image columns, blank labels, recorded key -> legendDiscrete('recorded')", () => {
  type R = { tier: string; a: string; b: string | null };
  const rows: R[] = [
    { tier: "S", a: "https://x/1.png", b: "https://x/2.png" },
    { tier: "A", a: "https://x/3.png", b: null },
  ];
  const html = renderHTML(
    defineTable<R>()
      .columns((c) => [c.text("tier"), c.text("a"), c.text("b")])
      .tiers(["S", "A", "B"], "tier", ["a", "b"], {
        colors: ["#ff7f7f", "#ffbf7f", "#ffdf7f"],
        style: "light",
      })
      .legendDiscrete("recorded")
      .build(),
    rows,
    { css: "none" },
  );
  expect(html).toContain('data-sdvt-theme="tier"');
  expect(html).toMatch(/data-col="tier" style="background-color:#ff7f7f;color:#000000;font-weight:bold">S</);
  expect(html).toContain('<img class="sdvt-mark" src="https://x/1.png" alt="" style="height:55px">');
  expect(html).toMatch(/data-row="1">.*?data-col="b"[^>]*><\/td>/s);
  expect(html).toMatch(/<th scope="col"[^>]*data-col="a"[^>]*><\/th>/);
  expect(html).toMatch(/<th scope="col"[^>]*data-col="tier"[^>]*><\/th>/);
  expect(html).toContain("background-color:#ffdf7f");
  expect(html).toContain(">B<");
  expect(() =>
    renderHTML(
      defineTable<R>()
        .columns((c) => [c.text("tier")])
        .tiers(["S"], "tier", [])
        .build(),
      rows,
    ),
  ).toThrow(/colors is missing/);
});
test("themePreview: one HTML per theme, n rows, compact; subset", () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("wins")])
    .title("x")
    .build();
  const all = themePreview(spec, STANDINGS);
  expect(Object.keys(all).sort()).toEqual([...THEME_NAMES].sort());
  for (const [name, html] of Object.entries(all)) {
    expect(html, name).toContain(`data-sdvt-theme="${name}"`);
    expect(html).toContain('data-sdvt-density="compact"');
    expect(html.match(/<tr class="sdvt-row[ "]/g)?.length).toBe(5); // striped themes add " sdvt-stripe"
  }
  expect(
    Object.keys(themePreview(spec, STANDINGS, ["midnight", "tufte"], { n: 2, density: "social" })),
  ).toEqual(["midnight", "tufte"]);
  expect(() => themePreview(spec, STANDINGS, undefined, { n: 0 })).toThrow(/positive whole number/);
});
