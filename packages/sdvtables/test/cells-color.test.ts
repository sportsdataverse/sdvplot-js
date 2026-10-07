import { resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeEach, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { renderHTML } from "../src/html/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
const warnings: string[] = [];
beforeEach(() => {
  warnings.length = 0;
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
});
const cellOf = (html: string, key: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?<td[^>]*data-col="${key}"[^>]*>(.*?)</td>`, "s").exec(html)?.[1] ?? "";
test("colorPills: fixed domain → exact fill, ink by contrast, width = widest label in ch; null skipped (Review Focus 2); no domain warns once", () => {
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.colorPills("wins", { domain: [0, 17], digits: 0 })])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(cellOf(html, "wins")).toBe(
    `<span style="display:inline-block;width:2ch;padding-left:3px;padding-right:3px;height:25px;line-height:25px;background-color:#6a9769;color:#000000;border-radius:10px;text-align:center">15</span>`,
  );
  const nul = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.colorPills("net_epa", { digits: 3 })])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(cellOf(nul, "net_epa", 7)).toBe("");
  expect(warnings.filter((w) => w.includes("no domain")).length).toBe(1);
  const na = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.colorPills("net_epa", { domain: [-0.2, 0.2], naColor: "#cccccc80", digits: 2 })])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(cellOf(na, "net_epa", 7)).toContain("background-color:#cccccc80;color:#000000");
  const out = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.colorPills("wins", { domain: [10, 17], digits: 0 })])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(cellOf(out, "wins", 3)).toContain("background-color:#808080");
  expect(warnings).toContain("4 value(s) fall outside the domain (10 to 17) and are drawn grey");
});
test("colorPills rank fill, percent format, outline; colorRanks fills the td", () => {
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [
        c.colorPills("pf", {
          fillType: "rank",
          domain: [1, 8],
          digits: 0,
          outlineColor: "#000",
          outlineWidth: 1,
        }),
        c.colorRanks("srs_rank", { domain: [1, 32] }),
      ])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(cellOf(html, "pf", 4)).toContain("background-color:#c84630;");
  expect(cellOf(html, "pf", 4)).toContain(';border:1px solid #000">525</span>');
  expect(html).toMatch(/data-col="srs_rank" style="background-color:#a0c6a8;color:#000000">9<\/td>/);
  const pct = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.colorPills("net_epa", { domain: [-0.2, 0.2], formatType: "percent", digits: 1 })])
      .build(),
    STANDINGS.slice(0, 1),
    { css: "none" },
  );
  expect(cellOf(pct, "net_epa")).toContain(">7.1%</span>");
});
test("percentileBar: auto scale of proportions, marker text, na label in broken track; the th width is the column's own width (default 220px)", () => {
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.percentileBar("net_epa", { domain: [0, 100] })])
      .build(),
    [{ ...STANDINGS[0]!, net_epa: 0.72 }, STANDINGS[7]!],
    { css: "none" },
  );
  const bar = cellOf(html, "net_epa");
  expect(bar).toContain('class="sdvt-pbar"');
  expect(bar).toContain("left:72%");
  expect(bar).toContain(">72<");
  expect(bar).toContain("width:22px;height:22px");
  const na = cellOf(html, "net_epa", 1);
  expect(na).toContain("—");
  expect(na).toContain("color:#9A9A9A");
  expect(na).not.toContain("left:");
  expect(html).toContain('data-col="net_epa" data-kind="percentileBar" style="width:220px"');
});
test("indicatorBox (Python defaults: #FCCF10 / #EEEEEE, 20px), highlight, highlightNa, image", () => {
  const html = renderHTML(
    defineTable<Standing>()
      .columns((c) => [
        c.indicatorBox("ties", { truthy: [0] }),
        c.highlight("wins", { key: "wins", op: ">=", value: 13 }),
        c.highlightNa("net_epa", { missingText: "n/a", italic: true }),
        c.image("qb_espn_id", { height: "20px" }),
      ])
      .build(),
    [STANDINGS[0]!, STANDINGS[7]!],
    { css: "none" },
  );
  expect(cellOf(html, "ties")).toBe(
    '<span style="display:inline-block;width:20px;height:20px;background-color:#FCCF10;vertical-align:middle;margin:4px 1px"></span>',
  );
  expect(html).toMatch(/data-col="wins" style="background-color:#FFF3B0">15</);
  expect(html).toMatch(/data-row="1">.*?data-col="wins">4</s);
  expect(html).toMatch(
    /data-row="1">.*?data-col="net_epa" style="background-color:#F0F0F0;font-style:italic">n\/a</s,
  );
  expect(cellOf(html, "qb_espn_id")).toBe('<img class="sdvt-mark" src="3139477" alt="" style="height:20px">');
});
test("percentileBar auto scale follows _layout.py:806: lo offset, only when hi > 1", () => {
  const at = (domain: [number, number], v: number): string =>
    cellOf(
      renderHTML(
        defineTable<Standing>()
          .columns((c) => [c.percentileBar("net_epa", { domain })])
          .build(),
        [{ ...STANDINGS[0]!, net_epa: v }],
        { css: "none" },
      ),
      "net_epa",
    );
  const a = at([20, 80], 0.5);
  expect(a).toContain("left:50%");
  expect(a).toContain(">50<");
  const b = at([0, 0.5], 0.25);
  expect(b).toContain("left:50%");
  expect(b).toContain(">0<"); // unscaled: 0.25 on [0, 0.5], text 0 at 0 decimals
});
