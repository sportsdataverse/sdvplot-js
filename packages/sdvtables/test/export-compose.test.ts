import { InputError } from "@sportsdataverse/sdvplot";
import { expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { gridTables, slug, stackTables } from "../src/export/compose.js";
import { renderHTML } from "../src/html/index.js";
import { rows, spec } from "./fixtures/engine.js";
import type { Standing } from "./fixtures/standings.js";

const east = { spec, rows: rows.slice(0, 2) };
const west = { spec, rows: rows.slice(2) };

test("gridTables lays tables out in a CSS grid with Python's defaults", () => {
  const html = gridTables([east, west, east]);
  expect(html).toContain(
    'style="display:grid;grid-template-columns:repeat(2,max-content);gap:24px;align-items:start;justify-content:center"',
  );
  expect(html.match(/class="sdvt sdvt-theme-sdv /g)?.length).toBe(3);
  expect(html).toContain(renderHTML(spec, east.rows));
});
test("labels recycle and are escaped; title/caption compose with Python's style values; align maps", () => {
  const html = gridTables([east, west], {
    ncol: 1,
    gap: 8,
    align: "bottom",
    labels: ["A&E"],
    title: "Division leaders",
    caption: "Data: ESPN",
    sourceNote: "@sdv",
    captionRule: true,
  });
  expect(html.match(/<div class="sdvt-compose-label">A&amp;E<\/div>/g)?.length).toBe(2);
  expect(html).toContain("align-items:end");
  expect(html).toContain('<div class="sdvt-compose-title">Division leaders</div>'); // Python gt_grid: htmltools.div
  expect(html).toContain(
    '<footer class="sdvt-compose-foot"><p class="sdvt-compose-caption sdvt-compose-rule">Data: ESPN</p><p class="sdvt-compose-source">@sdv</p></footer>',
  );
  // _export.py _STYLE_DEFAULTS: caption #8A8A8A centred 12px, rule under the caption in its colour
  expect(html).toContain(
    ".sdvt-compose-caption{font-size:12px;font-weight:400;color:#8A8A8A;text-align:center;margin:10px 0 0}",
  );
  expect(html).toContain(".sdvt-compose-rule{border-bottom:1px solid #8A8A8A;padding-bottom:6px}");
  expect(gridTables([east])).not.toContain("<header");
});
test("stackTables is a flex column; pre-rendered HTML strings are accepted as items", () => {
  const html = stackTables([east, "<p>custom</p>"], { align: "left" });
  expect(html).toContain('style="display:flex;flex-direction:column;gap:16px;align-items:flex-start"');
  expect(html).toContain("<p>custom</p>");
});
test("argument checks run before anything renders", () => {
  expect(() => gridTables([east], { ncol: 0 })).toThrow(InputError);
  expect(() => gridTables([east], { ncol: 1.5 })).toThrow(InputError);
  expect(() => gridTables([east], { labels: [] })).toThrow(InputError);
  expect(() => gridTables([east], { align: "middle" as never })).toThrow(InputError);
  expect(() => stackTables([east], { gap: -1 })).toThrow(InputError);
  expect(() => stackTables([east], { align: "top" as never })).toThrow(InputError);
  expect(() => stackTables([], {})).toThrow(InputError);
});
test("slug matches Python _slug", () => {
  expect(slug("North / East")).toBe("north-east");
  expect(slug(" AFC West! ")).toBe("afc-west");
  expect(slug(2024)).toBe("2024");
  expect(slug("a.b_c-d")).toBe("a.b_c-d");
});
test("one spec composed twice: unique wrapper ids, each table's decoration rules scoped to its own id", () => {
  const decorated = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("wins")])
    .cutline(3)
    .build();
  const id = /id="(sdvt-[0-9a-f]{8})"/.exec(renderHTML(decorated, rows))?.[1] as string;
  const item = { spec: decorated, rows };
  for (const html of [gridTables([item, item, item]), stackTables([item, item, item])]) {
    const ids = [...html.matchAll(/<div class="sdvt [^"]*" id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual([id, `${id}-2`, `${id}-3`]);
    const every = html.match(/\sid="[^"]+"/g) ?? [];
    expect(every.length).toBe(3);
    expect(new Set(every).size).toBe(every.length);
    html
      .split(/(?=<div class="sdvt )/)
      .slice(1)
      .forEach((table, i) => {
        const scoped = [...table.matchAll(/#(sdvt-[\w-]+)/g)].map((m) => m[1]);
        expect(scoped.length).toBeGreaterThan(0);
        expect(new Set(scoped)).toEqual(new Set([ids[i]]));
      });
  }
});
test("an id that is also a hex colour: the repeat's selectors move, the colour value does not", () => {
  // "fade" is a valid table id and the colour #fade (#ffaadd, alpha ee); the cut line is drawn in it
  const fade = defineTable<Standing>()
    .id("fade")
    .columns((c) => [c.text("team"), c.int("wins")])
    .cutline(3, { color: "#fade" })
    .build();
  const item = { spec: fade, rows };
  const [, , second] = stackTables([item, item]).split(/(?=<div class="sdvt )/);
  const css = [...(second ?? "").matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("");
  expect(css).toMatch(/#fade-2\b/); // the selectors are the repeat's own
  expect(css).toMatch(/dashed #fade[;}]/); // the colour is untouched
  expect(css).not.toContain("dashed #fade-2");
});
