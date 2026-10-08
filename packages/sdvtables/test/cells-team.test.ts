// test/cells-team.test.ts — uses prepare() only (never preloadAll), so the gsis test proves prepare() loads the gsis map (J27)
import { UnresolvedTeamError, resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeEach, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { readableInk } from "../src/html/cells.js";
import { prepare, renderHTML } from "../src/html/index.js";
import type { TableSpec } from "../src/spec.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
const ARCHIVE =
  /^https:\/\/sdv\.nyc3\.cdn\.digitaloceanspaces\.com\/assets\/public\/sha256\/[0-9a-f]{2}\/[0-9a-f]{64}\.(png|svg|jpg|gif|bmp)$/;
const warnings: string[] = [];
beforeEach(() => {
  warnings.length = 0;
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
});
const cellOf = (html: string, key: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?<td[^>]*data-col="${key}"[^>]*>(.*?)</td>`, "s").exec(html)?.[1] ?? "";
const render = async (spec: TableSpec<Standing>, rows: readonly Standing[]): Promise<string> => {
  await prepare(spec);
  return renderHTML(spec, rows, { css: "none" });
};
test("headshot gsis: throws until prepare() loads the gsis map (J27), then resolves to an image; ESPN combiner URL; blank id → empty", async () => {
  const gsis = defineTable<Standing>()
    .columns((c) => [c.headshot("qb_espn_id", { league: "nfl", idSystem: "gsis" })])
    .build();
  const mahomes = [{ ...STANDINGS[0]!, qb_espn_id: "00-0033873" }];
  expect(() => renderHTML(gsis, mahomes)).toThrow(/gsis map is not loaded/);
  expect(cellOf(await render(gsis, mahomes), "qb_espn_id")).toMatch(
    /^<img class="sdvt-mark" src="https:\/\/(static\.www\.nfl\.com|a\.espncdn\.com)\/[^"]+" alt="00-0033873" style="height:30px">$/,
  );
  const html = await render(
    defineTable<Standing>()
      .columns((c) => [c.headshot("qb_espn_id", { league: "nfl", height: 40 })])
      .build(),
    STANDINGS.slice(0, 1),
  );
  expect(cellOf(html, "qb_espn_id")).toBe(
    '<img class="sdvt-mark" src="https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/3139477.png" alt="3139477" style="height:40px">',
  );
  expect(
    cellOf(
      await render(
        defineTable<Standing>()
          .columns((c) => [c.headshot("qb_espn_id", { league: "nfl" })])
          .build(),
        [{ ...STANDINGS[0]!, qb_espn_id: "" }],
      ),
      "qb_espn_id",
    ),
  ).toBe("");
});
test("logo: <img> with archive URL, alt = team name (prepare), data-sdvplot-team, height px; includeName keeps text after", async () => {
  const html = await render(
    defineTable<Standing>()
      .columns((c) => [c.logo("team", { league: "nfl", includeName: true, height: 24 })])
      .build(),
    STANDINGS,
  );
  const kc = cellOf(html, "team");
  const m =
    /^<img class="sdvt-mark" src="([^"]+)" alt="Kansas City Chiefs" style="height:24px" data-sdvplot-team="12">KC$/.exec(
      kc,
    );
  expect(m, kc).not.toBeNull();
  expect(m![1]).toMatch(ARCHIVE);
  expect(
    await render(
      defineTable<Standing>()
        .columns((c) => [c.wordmark("team", { league: "nfl" })])
        .build(),
      STANDINGS.slice(0, 1),
    ),
  ).toMatch(
    /<img class="sdvt-mark" src="https:[^"]+" alt="Kansas City Chiefs" style="height:30px" data-sdvplot-team="12">/,
  );
});
test("unknown team keeps text, no img, ONE warning per column call listing every unknown value (J28, Review Focus 3); strict throws; A&M resolves from the raw value (Review Focus 1)", async () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({
    ...STANDINGS[0]!,
    team: i % 2 === 0 ? "ZZZ" : "YYY",
  }));
  const html = await render(
    defineTable<Standing>()
      .columns((c) => [c.logo("team", { league: "nfl" })])
      .build(),
    rows,
  );
  expect(cellOf(html, "team", 29)).toBe("YYY");
  expect(html).not.toContain("<img");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatch(/ZZZ/);
  expect(warnings[0]).toMatch(/YYY/);
  await expect(
    render(
      defineTable<Standing>()
        .columns((c) => [c.logo("team", { league: "nfl", strict: true })])
        .build(),
      rows,
    ),
  ).rejects.toThrow(UnresolvedTeamError);
  const am = await render(
    defineTable<Standing>()
      .columns((c) => [c.logo("team", { league: "cfb", includeName: true })])
      .build(),
    [{ ...STANDINGS[0]!, team: "Texas A&M" }],
  );
  expect(cellOf(am, "team")).toMatch(
    /^<img class="sdvt-mark" src="https:[^"]+" alt="Texas A&amp;M Aggies".*>Texas A&amp;M$/,
  );
});
test("mergeStackTeamColor (Python markup); teamColorBar/Bg put their color on the td; readableInk steps 0.95 → 0", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.mergeStackTeamColor("qb", "team", "team", { league: "nfl" }),
      c.teamColorBar("team", { league: "nfl" }),
      c.teamColorBg("division", { league: "nfl", alpha: 0.5, label: "Div" }),
    ])
    .build();
  const html = await render(spec, STANDINGS.slice(0, 1));
  expect(cellOf(html, "qb")).toBe(
    '<div style="line-height:12px"><span style="font-weight:bold;font-variant:small-caps;color:black;font-size:14px">Patrick Mahomes</span></div>\n<div style="line-height:10px"><span style="font-weight:bold;color:#e31837;font-size:12px">KC</span></div>',
  );
  expect(html).toMatch(
    /<td class="sdvt-cell sdvt-kind-teamColorBar[^"]*" data-col="team" style="border-left:4px solid #e31837">KC<\/td>/,
  );
  // teamColorBg's team is the column's own value → "West" is not a team → naColor #b3b3b3 at alpha 0.5 (0x80), one warning
  expect(html).toMatch(/data-col="division" style="background-color:#b3b3b380">West<\/td>/);
  expect(warnings.some((w) => w.includes("West"))).toBe(true);
  expect(readableInk("#e31837", "#ffb612", "#ffffff")).toBe("#e31837"); // 4.72:1 clears
  expect(readableInk("#ffb81c", "#e31837", "#ffffff")).toBe("#e31837"); // gold 1.73:1 fails, red clears
  // both fail (1.73, 1.19): mix(#000000, #ffb81c, w) for w = 0.95, 0.90, …; the first to clear 4.5:1 is w = 0.60 → #996e11 (4.57:1)
  expect(readableInk("#ffb81c", "#fff000", "#ffffff")).toBe("#996e11");
});

test("NaN in a team column renders empty in every team-aware kind", async () => {
  const nan = Number.NaN as unknown as string;
  const rows = [
    { ...STANDINGS[0]!, team: nan, division: nan, conf: nan as never, qb: nan, result_last: nan as never },
  ];
  const html = await render(
    defineTable<Standing>()
      .columns((c) => [
        c.logo("team", { league: "nfl" }),
        c.teamColorBar("division", { league: "nfl" }),
        c.teamColorBg("conf", { league: "nfl" }),
        c.mergeStackTeamColor("qb", "result_last", "team", { league: "nfl" }),
      ])
      .build(),
    rows,
  );
  expect(html).not.toMatch(/NaN/);
});
