// test/cells-fmtr-hardening.test.ts — PR #64 self-review: tooltip whitespace, row colours that are not colours,
// blank / unknown iconRef / iconColorRef, highlight with nothing to mark, iconAssign on an all-negative column.
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { TableSpecError } from "../src/errors.js";
import { cssValue } from "../src/html/escape.js";
import { renderHTML } from "../src/html/index.js";
const tdOf = (html: string, key: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?(<td[^>]*data-col="${key}"[^>]*>.*?</td>)`, "s").exec(html)?.[1] ?? "";

test("tooltip keeps every letter s: text cell, numeric cell with a suffix, mark-only cell's raw fallback", () => {
  type R = { name: string; wins: number; mark: string };
  const out = renderHTML(
    defineTable<R>()
      .columns((c) => [
        c.text("name", { tooltip: true }),
        c.dataBar("wins", { tooltip: true, numberFormat: { suffix: " wins" } }),
        c.image("mark", { tooltip: true }),
      ])
      .build(),
    [{ name: "Boston   Celtics", wins: 3, mark: "https://example.com/bos.png" }],
    { css: "none" },
  );
  expect(tdOf(out, "name")).toContain('title="Boston Celtics"');
  expect(tdOf(out, "wins")).toContain('title="3 wins"');
  expect(tdOf(out, "mark")).toContain('title="https://example.com/bos.png"');
});

test("colorRef: url(...), unknown-name and blank row values are treated as blank, never reach CSS, never throw", () => {
  type R = { x: number; col: string | null };
  const rows: R[] = [
    { x: 3, col: "url(https://evil.example/p)" },
    { x: 5, col: "redd" },
    { x: 4, col: null },
    { x: 2, col: "#ff0000" },
  ];
  const out = renderHTML(
    defineTable<R>()
      .columns((c) => [
        c.dataBar("x", { colorRef: "col", textPosition: "outside-end", textColor: "#111111" }),
      ])
      .build(),
    rows,
    { css: "none" },
  );
  expect(out).not.toMatch(/url\(/);
  expect(out).not.toContain("redd");
  expect(tdOf(out, "x", 3)).toContain("background:#ff0000");
  for (const kind of ["bubble", "colorRanks", "colorPills"] as const) {
    const html = renderHTML(
      defineTable<R>()
        .columns((c) =>
          kind === "bubble"
            ? [c.bubble("x", { colorRef: "col", textColor: "#111111" })]
            : kind === "colorRanks"
              ? [c.colorRanks("x", { colorRef: "col", showText: false })]
              : [c.colorPills("x", { colorRef: "col" })],
        )
        .build(),
      rows,
      { css: "none" },
    );
    expect(html, kind).not.toMatch(/url\(/);
    expect(html, kind).not.toContain("redd");
  }
});

test("cssValue rejects url( as a backstop", () => {
  expect(() => cssValue("URL(x)", "f")).toThrow(TableSpecError);
  expect(cssValue("#fff", "f")).toBe("#fff");
});

test("iconSet: blank or unknown iconRef / iconColorRef fall back to the bucket icon and colour", () => {
  type R = { x: number; ic: string | null; col: string | null };
  const out = renderHTML(
    defineTable<R>()
      .columns((c) => [
        c.iconSet("x", { iconRef: "ic", iconColorRef: "col", icons: ["circle"], colors: ["#123456"] }),
      ])
      .build(),
    [
      { x: 3, ic: null, col: null },
      { x: 4, ic: "toString", col: "url(x)" },
      { x: 5, ic: "star", col: "#00ff00" },
    ],
    { css: "none" },
  );
  expect(out).not.toContain('fill="null"');
  expect(tdOf(out, "x", 0)).toContain('fill="#123456"');
  expect(tdOf(out, "x", 1)).toContain('fill="#123456"');
  expect(tdOf(out, "x", 1)).toContain('d="M8 1a7'); // circle
  expect(tdOf(out, "x", 2)).toContain('fill="#00ff00"');
  expect(tdOf(out, "x", 2)).toContain('d="M8 0.8'); // star
});

test("highlight with neither a predicate nor an extreme throws at build()", () => {
  expect(() =>
    defineTable<{ x: number }>()
      // @ts-expect-error -- a JS caller can omit `when`
      .columns((c) => [c.highlight("x")])
      .build(),
  ).toThrow(/highlight needs a predicate/);
});

test("iconAssign on an all-negative column draws no icons, only the value", () => {
  const out = renderHTML(
    defineTable<{ x: number }>()
      .columns((c) => [c.iconAssign("x", { showValues: "right" })])
      .build(),
    [{ x: -3 }, { x: -1 }],
    { css: "none" },
  );
  expect(tdOf(out, "x")).not.toContain("<svg");
  expect(tdOf(out, "x")).toContain("-3");
});
