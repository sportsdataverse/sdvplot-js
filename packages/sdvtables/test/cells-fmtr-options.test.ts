// test/cells-fmtr-options.test.ts — reactablefmtr options on existing kinds: colorRanks (color_tiles / color_scales)
// colorRef, bias, span, showText, evenBreaks; colorPills (pill_buttons) colorRef; highlight extremes; tooltip.
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { prepare, renderHTML } from "../src/html/index.js";
import { ramp } from "../src/scale.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
const tdOf = (html: string, key: string, row = 0): string =>
  new RegExp(`data-row="${row}">.*?(<td[^>]*data-col="${key}"[^>]*>.*?</td>)`, "s").exec(html)?.[1] ?? "";

test("ramp bias places the stops at (i / k) ^ bias, as grDevices::colorRamp; bias 1 is unchanged", () => {
  expect(ramp(["#000000", "#ffffff"], [0, 1])(0.5)).toBe("#808080");
  expect(ramp(["#000000", "#ffffff", "#ff0000"], [0, 1], 2)(0.25)).toBe("#ffffff");
  // R: rgb(colorRamp(c("#000000", "#ffffff", "#ff0000"), bias = 0.5)(0.5), maxColorValue = 255) == "#B4B4B4"
  expect(ramp(["#000000", "#ffffff", "#ff0000"], [0, 1], 0.5)(0.5)).toBe("#b4b4b4");
  expect(() => ramp(["#000000"], [0, 1], 0)).toThrow(/bias/);
});

test("colorRanks: colorRef / team per row; showText false; evenBreaks buckets; span over several columns", async () => {
  const rows = STANDINGS.map((r) => ({ ...r, tint: r.division === "West" ? "#d0e4f5" : "#f5d0d0" }));
  type R = (typeof rows)[number];
  const out = renderHTML(
    defineTable<R>()
      .columns((c) => [
        c.colorRanks("wins", { colorRef: "tint" }),
        c.colorRanks("losses", { evenBreaks: true, showText: false }),
        c.colorRanks("pf", { span: ["pf", "pa"], palette: ["#000000", "#ffffff"] }),
      ])
      .build(),
    rows,
    { css: "none" },
  );
  expect(tdOf(out, "wins")).toContain('style="background-color:#d0e4f5;color:#000000"');
  expect(tdOf(out, "wins", 4)).toContain("background-color:#f5d0d0");
  // losses 2 (KC) is the bottom fifth -> the palette's first colour; text hidden
  expect(tdOf(out, "losses")).toContain('style="background-color:#3d8b6e;color:transparent"');
  // R: dplyr::ntile(losses, 5) = 1 2 2 4 1 3 3 5 -- LV and NE tie at 13, LV first by position
  expect(tdOf(out, "losses", 3)).toContain("background-color:#db9070");
  expect(tdOf(out, "losses", 7)).toContain("background-color:#be4d3a");
  // span: pf and pa share 289..525, so NE's 289 points scored is black and BUF's 525 white
  expect(tdOf(out, "pf", 7)).toContain("background-color:#000000");
  expect(tdOf(out, "pf", 4)).toContain("background-color:#ffffff");
  const team = defineTable<Standing>()
    .columns((c) => [c.colorRanks("wins", { team: "team", league: "nfl" })])
    .build();
  await prepare(team);
  expect(tdOf(renderHTML(team, STANDINGS, { css: "none" }), "wins")).toContain(
    "background-color:#e31837;color:#ffffff",
  );
  const all = renderHTML(
    defineTable<Standing>()
      .columns((c) => [c.colorRanks("wins", { span: true, palette: ["#000000", "#ffffff"] })])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  // span TRUE: every numeric column (0 ties .. 525 pf), so 15 wins is nearly black
  expect(tdOf(all, "wins")).toContain("background-color:#070707");
});

test("colorPills colorRef: the pill takes the row's colour; ink by contrast", () => {
  const rows = STANDINGS.map((r) => ({ ...r, tint: r.conf === "AFC" ? "#002244" : "#ffffff" }));
  const out = renderHTML(
    defineTable<(typeof rows)[number]>()
      .columns((c) => [c.colorPills("wins", { colorRef: "tint", domain: [0, 17], digits: 0 })])
      .build(),
    rows,
    { css: "none" },
  );
  expect(tdOf(out, "wins")).toContain("background-color:#002244;color:#ffffff");
});

test("highlight extremes: min red, max green, bold, every tie; textColor and fill override", () => {
  const out = renderHTML(
    defineTable<Standing>()
      .columns((c) => [
        c.highlight("wins", "both"),
        c.highlight("pf", "max", { fill: "#FFF3B0", textColor: "black" }),
        c.highlight("losses", "min"),
      ])
      .build(),
    STANDINGS,
    { css: "none" },
  );
  expect(tdOf(out, "wins")).toContain('style="color:green;font-weight:bold"'); // KC 15
  expect(tdOf(out, "wins", 3)).toContain('style="color:red;font-weight:bold"'); // LV 4
  expect(tdOf(out, "wins", 7)).toContain('style="color:red;font-weight:bold"'); // NE 4 ties
  expect(tdOf(out, "wins", 1)).not.toContain("style=");
  expect(tdOf(out, "pf", 4)).toContain('style="background-color:#FFF3B0;color:black;font-weight:bold"');
  expect(tdOf(out, "losses")).toContain("color:red");
  expect(tdOf(out, "losses", 3)).not.toContain("style=");
});

test("tooltip: the cell's text as its title attribute; a mark-only cell falls back to the raw value", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.num("net_epa", { digits: 3, tooltip: true }),
      c.logo("team", { league: "nfl", tooltip: true }),
      c.dataBar("wins", { tooltip: true }),
      c.int("losses"),
    ])
    .build();
  await prepare(spec);
  const out = renderHTML(spec, STANDINGS, { css: "none" });
  expect(tdOf(out, "net_epa", 3)).toContain('title="−0.146">−0.146</td>');
  expect(tdOf(out, "team")).toContain('title="KC">');
  expect(tdOf(out, "wins")).toContain('title="15">');
  expect(tdOf(out, "losses")).not.toContain("title=");
  expect(tdOf(out, "net_epa", 7)).not.toContain("title=");
});
