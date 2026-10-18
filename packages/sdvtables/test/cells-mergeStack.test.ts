// test/cells-mergeStack.test.ts — reactablefmtr merge_column: two values with their own styles, optional mark.
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { prepare, renderHTML } from "../src/html/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
const cellOf = (html: string, key: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?<td[^>]*data-col="${key}"[^>]*>(.*?)</td>`, "s").exec(html)?.[1] ?? "";

test("defaults: the value 14px bold, then the stack 12px #777, 3px apart (merge_column)", () => {
  const out = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.mergeStack("qb", "team")])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(cellOf(out, "qb")).toBe(
    '<span style="font-size:14px;font-weight:bold;font-style:normal;margin-right:3px">Patrick Mahomes</span><span style="font-size:12px;color:#777;font-weight:normal;font-style:normal">KC</span>',
  );
});

test("positions below / above / left with spacing; styles; a headshot or logo mark first", async () => {
  const below = renderHTML(
    defineTable<Standing>()
      .columns((c) => [
        c.mergeStack("qb", "division", {
          position: "below",
          spacing: 2,
          color: "#222222",
          stackStyle: "italic",
        }),
        c.mergeStack("team", "conf", { position: "left", weight: "normal" }),
      ])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(cellOf(below, "qb")).toBe(
    '<div><div style="font-size:14px;color:#222222;font-weight:bold;font-style:normal;margin-bottom:5px">Patrick Mahomes</div><div style="font-size:12px;color:#777;font-weight:normal;font-style:italic">West</div></div>',
  );
  expect(cellOf(below, "team")).toMatch(
    /^<span style="[^"]*margin-right:3px">AFC<\/span><span [^>]*>KC<\/span>$/,
  );
  const marked = defineTable<Standing>()
    .columns((c) => [
      c.mergeStack("qb", "team", {
        mark: "headshot",
        markKey: "qb_espn_id",
        league: "nfl",
        position: "above",
      }),
      c.mergeStack("pf", "pa", { mark: "logo", team: "team", league: "nfl", markHeight: 26 }),
    ])
    .build();
  await prepare(marked);
  const out = renderHTML(marked, STANDINGS, { css: "none" });
  expect(cellOf(out, "qb")).toMatch(
    /^<div style="display:flex;align-items:center;gap:6px"><img class="sdvt-mark" src="https:\/\/a\.espncdn\.com\/combiner\/i\?img=\/i\/headshots\/nfl\/players\/full\/3139477\.png" alt="3139477" style="height:20px"><div><div style="[^"]*margin-bottom:3px">KC<\/div>/,
  );
  expect(cellOf(out, "pf")).toContain('alt="Kansas City Chiefs" style="height:26px" data-sdvplot-team="12"');
  expect(() =>
    renderHTML(
      defineTable<Standing>()
        .columns((c) => [c.mergeStack("qb", "team", { mark: "headshot", league: "nfl" })])
        .build(),
      STANDINGS,
    ),
  ).toThrow(/set markKey and league/);
  expect(() =>
    renderHTML(
      defineTable<Standing>()
        .columns((c) => [c.mergeStack("qb", "nope" as "team")])
        .build(),
      STANDINGS,
    ),
  ).toThrow(/column "nope" \(kind mergeStack\) is not a key/);
});
