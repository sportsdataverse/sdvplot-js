// test/cells-iconSet.test.ts — reactablefmtr icon_sets: icon and colour by dplyr::ntile bucket, per-row refs, positions.
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { ICON_NAMES, renderHTML } from "../src/html/index.js";
import { ntile } from "../src/scale.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
const cellOf = (html: string, key: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?<td[^>]*data-col="${key}"[^>]*>(.*?)</td>`, "s").exec(html)?.[1] ?? "";
const svg = (fill: string, d: string): string =>
  `<svg class="sdvt-icon" viewBox="0 0 16 16" width="16" height="16" fill="${fill}" aria-hidden="true" style="vertical-align:middle"><path d="${d}"/></svg>`;
const CIRCLE = "M8 1a7 7 0 1 0 0 14A7 7 0 1 0 8 1z";

test("dplyr::ntile: equal-count buckets, larger first, ties by position, nulls kept", () => {
  expect(ntile([5, 1, 3, null, 3, 9, 7, 2], 3)).toEqual([2, 1, 1, null, 2, 3, 3, 1]); // R: dplyr::ntile(c(5,1,3,NA,3,9,7,2), 3)
  expect(ntile([2, 6, 7, 13, 4, 9, 12, 13], 5)).toEqual([1, 2, 2, 4, 1, 3, 3, 5]);
  expect(ntile([1, 2], 5)).toEqual([1, 2]);
  expect(() => ntile([1], 0)).toThrow(/positive integer/);
});

test("defaults: the value, then one circle coloured by the value's third of the column (#15607A / #B0B0B0 / #FA8C00)", () => {
  const out = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.iconSet("pf")])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  // pf: KC 385 is 5th of 8 -> bucket 2; BUF 525 the top -> 3; NE 289 the bottom -> 1
  expect(cellOf(out, "pf")).toBe(
    `385<span style="display:inline-block;margin-left:8px">${svg("#B0B0B0", CIRCLE)}</span>`,
  );
  expect(cellOf(out, "pf", 4)).toContain('fill="#FA8C00"');
  expect(cellOf(out, "pf", 7)).toContain('fill="#15607A"');
  expect(out).toContain('class="sdvt-cell sdvt-kind-iconSet sdvt-right"');
});

test("icons bucket separately from colours; iconRef / iconColorRef read the row; opacity; left / above / below / over", () => {
  const rows = STANDINGS.map((r) => ({
    ...r,
    icon: r.result_last === "W" ? "check" : "xmark",
    tint: r.result_last === "W" ? "#1B7837" : "#B2182B",
  }));
  type R = (typeof rows)[number];
  const out = renderHTML(
    defineTable<R>()
      .columns((c) => [
        c.iconSet("pf", { icons: ["arrow-down", "arrow-up"], iconPosition: "left", opacity: 0.5 }),
        c.iconSet("wins", { iconRef: "icon", iconColorRef: "tint", iconPosition: "below", label: "W" }),
      ])
      .build(),
    rows,
    { css: "none" },
  );
  // KC pf 385 is in the top half of two buckets; colours still in thirds (bucket 2) at 50% alpha
  expect(cellOf(out, "pf")).toBe(
    `<span style="display:inline-block;margin-right:8px">${svg("#b0b0b080", "M8 1 14 8H10v7H6V8H2z")}</span>385`,
  );
  expect(cellOf(out, "wins")).toMatch(/^<div>15<\/div><div><svg [^>]*fill="#B2182B"[^>]*><path d="M3\.1 1 /);
  expect(cellOf(out, "wins", 1)).toContain('fill="#1B7837"');
  const over = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.iconSet("pf", { iconPosition: "over" })])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(cellOf(over, "pf")).toContain('<span style="font-size:0;color:transparent">385</span>');
  expect(ICON_NAMES).toContain("star");
  // an iconRef value that is not an icon name ("KC") falls back to the bucket icon instead of throwing
  const unknown = renderHTML(
    defineTable<R>()
      .columns((c) => [c.iconSet("pf", { iconRef: "team" })])
      .build(),
    rows,
    { css: "none" },
  );
  expect(cellOf(unknown, "pf")).toContain("<svg");
});
