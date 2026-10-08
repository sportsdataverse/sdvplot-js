// test/cells-plain.test.ts
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { wrapLabel } from "../src/html/decorations.js";
import { renderHTML } from "../src/html/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
const cell = (html: string, key: string, row = 0): string =>
  new RegExp(`<tr class="sdvt-row" data-row="${row}">.*?<td[^>]*data-col="${key}"[^>]*>(.*?)</td>`, "s").exec(
    html,
  )?.[1] ?? "";
test("num/int/pct/rank formatting; blanks render empty (Review Focus 2)", () => {
  // one column per key (build() rejects a key twice), so num and pct read different keys
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [
        c.num("net_epa", { digits: 3, forceSign: true }),
        c.int("pf"),
        c.pct("ties", { digits: 1, label: "Tie%" }),
        c.rank("srs_rank"),
      ])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(cell(html, "net_epa")).toBe("+0.063");
  expect(cell(html, "pf")).toBe("385");
  expect(cell(html, "ties")).toBe("0.0%");
  expect(cell(html, "srs_rank")).toBe('10<sup style="font-size:0.7em">th</sup>');
  expect(cell(html, "net_epa", 7)).toBe("");
  expect(html).not.toMatch(/NaN|undefined|null</);
});
test("pct scales proportions and respects scale:false; rank superscript off; int rounds", () => {
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [
        c.pct("net_epa", { digits: 1 }),
        c.rank("srs_rank", { superscript: false }),
        c.int("pa"),
      ])
      .build(),
    [{ ...STANDINGS[0]!, net_epa: 0.4567, pa: 326.6 }],
    { css: "none" },
  );
  expect(cell(html, "net_epa")).toBe("45.7%");
  expect(cell(html, "srs_rank")).toBe("10th");
  expect(cell(html, "pa")).toBe("327");
  const raw = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.pct("net_epa", { digits: 0, scale: false })])
      .build(),
    [{ ...STANDINGS[0]!, net_epa: 45 }],
    { css: "none" },
  );
  expect(cell(raw, "net_epa")).toBe("45%");
});
test("delta (Python gt_delta: arrows lead the unsigned magnitude; percent divides by from) and tally", () => {
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [
        c.delta("pf", "pa", { decimals: 0, arrows: true }),
        c.tally(["wins", "losses", "ties"], { share: true, shareOf: 0, label: "W-L-T" }),
      ])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(cell(html, "pf")).toBe('<span style="color:#B2182B">▼ 59</span>'); // KC: pa − pf = 326 − 385 = −59 → negative color, magnitude 59
  expect(cell(html, "pf", 2)).toBe('<span style="color:#B2182B">▼ 114</span>'); // DEN: 311 − 425 = −114
  expect(cell(html, "wins")).toBe("15-2-0 (88.2%)");
  expect(html).toContain('data-col="pf" data-kind="delta">Change</th>');
  expect(html).toContain(">W-L-T</th>");
  const pct = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.delta("pf", "pa", { percent: true, decimals: 1, color: false })])
      .build(),
    STANDINGS.slice(0, 1),
    { css: "none" },
  );
  expect(cell(pct, "pf")).toBe("−15.3%"); // (326 − 385) / 385 = −0.1532 → −15.3%
  const gap = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.tally(["wins", "losses"])])
      .build(),
    [{ ...STANDINGS[0]!, losses: Number.NaN }],
    { css: "none" },
  );
  expect(cell(gap, "wins")).toBe("15"); // a row with a missing count is left alone (_cells.py:1578-1579)
});
test("subheader and wrapLabels (Python _strwrap / _balanced)", () => {
  // width 10: greedy at 9 → ["Net EPA", "per play"]; target ceil(17 / 2) = 9 keeps the same two lines
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.num("net_epa", { label: "Net EPA per play", subheader: "offense minus defense" })])
      .wrapLabels({ width: 10 })
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(html).toContain(
    '>Net EPA<br>per play<span class="sdvt-subheader">offense minus defense</span></th>',
  );
  // greedy at 11 → ["Points", "allowed per", "game"]; balanced target ceil(24 / 3) = 8 → ["Points", "allowed", "per game"]
  expect(wrapLabel("Points allowed per game", 12, true)).toEqual(["Points", "allowed", "per game"]);
  expect(wrapLabel("Points allowed per game", 12, false)).toEqual(["Points", "allowed per", "game"]);
  expect(wrapLabel("Short", 12, true)).toEqual(["Short"]);
});

test("int rounds ties half-even like fmt_integer; NaN text never leaks", () => {
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.int("pf"), c.text("team")])
      .build(),
    [
      { ...STANDINGS[0]!, pf: 2.5, team: Number.NaN as unknown as string },
      { ...STANDINGS[0]!, pf: 3.5 },
    ],
    { css: "none" },
  );
  expect(cell(html, "pf")).toBe("2");
  expect(cell(html, "pf", 1)).toBe("4");
  expect(cell(html, "team")).toBe("");
});
