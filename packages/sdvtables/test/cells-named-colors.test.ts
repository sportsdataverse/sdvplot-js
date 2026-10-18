// test/cells-named-colors.test.ts — data-driven colour columns (`colorRef`, `iconColorRef`) take CSS colour names as
// well as hex (reactablefmtr users write "red" / "steelblue"); only the resolved hex reaches CSS, anything else is blank.
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { renderHTML } from "../src/html/index.js";
import { namedColor } from "../src/html/named-colors.js";

const tdOf = (html: string, key: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?(<td[^>]*data-col="${key}"[^>]*>.*?</td>)`, "s").exec(html)?.[1] ?? "";
type R = { x: number; col: string | null };
// navy -> white ink; " SteelBlue " (#4682b4) and yellow -> black ink, the higher WCAG contrast
const ROWS: R[] = [
  { x: 3, col: "navy" },
  { x: 5, col: " SteelBlue " },
  { x: 4, col: "YELLOW" },
];
const render = (spec: Parameters<typeof renderHTML<R>>[0], rows: R[] = ROWS) =>
  renderHTML(spec, rows, { css: "none" });

test("namedColor: the 148 CSS names, case-insensitive and trimmed; transparent, unknown and prototype keys are undefined", () => {
  expect(namedColor("red")).toBe("#ff0000");
  expect(namedColor(" SteelBlue ")).toBe("#4682b4");
  expect(namedColor("rebeccapurple")).toBe("#663399");
  expect(namedColor("darkgrey")).toBe("#a9a9a9");
  expect(namedColor("darkgray")).toBe("#a9a9a9");
  for (const s of ["transparent", "redd", "constructor", "__proto__", "toString", "", "grey50"])
    expect(namedColor(s), s).toBeUndefined();
});

test("dataBar colorRef: named colours fill the bar with the resolved hex", () => {
  const out = render(
    defineTable<R>()
      .columns((c) => [c.dataBar("x", { colorRef: "col" })])
      .build(),
  );
  expect(tdOf(out, "x", 0)).toContain("background:#000080");
  expect(tdOf(out, "x", 1)).toContain("background:#4682b4");
  expect(tdOf(out, "x", 2)).toContain("background:#ffff00");
  expect(out).not.toMatch(/SteelBlue|navy|YELLOW;/);
});

test("colorRanks colorRef: the resolved hex fills the cell and the ink is computed against it", () => {
  const out = render(
    defineTable<R>()
      .columns((c) => [c.colorRanks("x", { colorRef: "col" })])
      .build(),
  );
  expect(tdOf(out, "x", 0)).toContain("background-color:#000080;color:#ffffff");
  expect(tdOf(out, "x", 1)).toContain("background-color:#4682b4;color:#000000");
  expect(tdOf(out, "x", 2)).toContain("background-color:#ffff00;color:#000000");
});

test("colorPills colorRef: the pill takes the resolved hex, ink by contrast", () => {
  const out = render(
    defineTable<R>()
      .columns((c) => [c.colorPills("x", { colorRef: "col", domain: [0, 10], digits: 0 })])
      .build(),
  );
  expect(tdOf(out, "x", 0)).toContain("background-color:#000080;color:#ffffff");
  expect(tdOf(out, "x", 2)).toContain("background-color:#ffff00;color:#000000");
});

test("bubble colorRef: the bubble takes the resolved hex, ink by contrast", () => {
  const out = render(
    defineTable<R>()
      .columns((c) => [c.bubble("x", { colorRef: "col" })])
      .build(),
  );
  expect(tdOf(out, "x", 0)).toContain("background:#000080;color:#ffffff");
  expect(tdOf(out, "x", 1)).toContain("background:#4682b4;color:#000000");
  expect(tdOf(out, "x", 2)).toContain("background:#ffff00;color:#000000");
});

test("iconSet iconColorRef: named colours paint the icon in the resolved hex", () => {
  const out = render(
    defineTable<R>()
      .columns((c) => [c.iconSet("x", { iconColorRef: "col", icons: ["circle"], colors: ["#123456"] })])
      .build(),
  );
  expect(tdOf(out, "x", 0)).toContain('fill="#000080"');
  expect(tdOf(out, "x", 1)).toContain('fill="#4682b4"');
  expect(tdOf(out, "x", 2)).toContain('fill="#ffff00"');
});

test("injection strings, rgb()/hsl(), var(), transparent and unknown names still render blank and never throw", () => {
  const hostile = [
    "url(https://evil.example/p)",
    "expression(alert(1))",
    "var(--x)",
    "rgb(255, 0, 0)",
    "hsl(0 100% 50%)",
    "transparent",
    "red; background:url(x)",
    "notacolour",
    "   ",
  ];
  const rows: R[] = hostile.map((col, i) => ({ x: i + 1, col }));
  for (const kind of ["dataBar", "bubble", "colorRanks", "colorPills", "iconSet"] as const) {
    const html = render(
      defineTable<R>()
        .columns((c) => [
          kind === "dataBar"
            ? c.dataBar("x", { colorRef: "col", fill: ["#123456"] })
            : kind === "bubble"
              ? c.bubble("x", { colorRef: "col", colors: ["#123456"] })
              : kind === "colorRanks"
                ? c.colorRanks("x", { colorRef: "col", palette: ["#123456"] })
                : kind === "colorPills"
                  ? c.colorPills("x", { colorRef: "col", palette: ["#123456"] })
                  : c.iconSet("x", { iconColorRef: "col", icons: ["circle"], colors: ["#123456"] }),
        ])
        .build(),
      rows,
    );
    expect(html, kind).not.toMatch(/url\(|expression\(|var\(|rgb\(|hsl\(|notacolour/);
    expect(html, kind).not.toMatch(/(fill="|background(-color)?:)(red|transparent)/);
    expect(html, kind).toMatch(/#123456/i);
  }
});
