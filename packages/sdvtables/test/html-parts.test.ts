import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { escapeHtml } from "../src/html/escape.js";
import { renderHTML } from "../src/html/index.js";
import { assemble, attrsText, fontsLinkFor, renderParts, tableHTML } from "../src/html/parts.js";
import { rows, spec } from "./fixtures/engine.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";

beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll();
});

test("renderHTML is exactly assemble(renderParts(...))", () => {
  expect(assemble(renderParts(spec, rows))).toBe(renderHTML(spec, rows));
  expect(assemble(renderParts(spec, rows, { css: "none" }))).toBe(renderHTML(spec, rows, { css: "none" }));
});
test("parts: unescaped wrapper attrs in order, link separable, tableHTML is the <table> block", () => {
  const p = renderParts(spec, rows);
  expect(Object.keys(p.wrapperAttrs)).toEqual(["class", "id", "data-sdvt-theme", "data-sdvt-density"]);
  expect(p.wrapperAttrs.class).toMatch(/^sdvt sdvt-theme-sdv sdvt-t-[0-9a-f]{8}$/); // Phase 4: name class + themeKey class
  expect(p.wrapperAttrs).toMatchObject({ "data-sdvt-theme": "sdv", "data-sdvt-density": "compact" });
  expect(p.id).toMatch(/^sdvt-[0-9a-f]{8}$/);
  expect(renderParts(spec, rows, { fonts: false }).link).toBe("");
  expect(fontsLinkFor(spec)).toBe(p.link);
  expect(tableHTML(p)).toMatch(/^<table>.*<\/table>$/s);
  expect(attrsText({ class: "a", title: `x"<y>` })).toBe(` class="a" title="x&quot;&lt;y&gt;"`);
});
test("interactive opts: aria-sort + sort button on sortable columns only; hidden drops a column", () => {
  const p = renderParts(spec, rows, {
    interactive: true,
    sort: { col: "wins", dir: "desc" },
    hidden: ["net_epa"],
  });
  expect(p.head).toContain(
    '<th scope="col" class="sdvt-label sdvt-right" data-col="wins" data-kind="int" aria-sort="descending"><button type="button" class="sdvt-sort" data-sdv-sort="wins">Wins</button></th>',
  );
  expect(p.head).toContain('data-col="team" data-kind="text" aria-sort="none"><button');
  expect(p.head).toContain(
    '<th scope="col" class="sdvt-label sdvt-left" data-col="qb" data-kind="text">Quarterback</th>',
  );
  expect(p.head).not.toContain('data-col="net_epa"');
  expect(p.rows).not.toContain('data-col="net_epa"');
  expect(renderParts(spec, rows).head).not.toContain("aria-sort");
});
test("apostrophes escape as &#x27; (React's form)", () => {
  expect(escapeHtml("O'Neal")).toBe("O&#x27;Neal");
  const p = renderParts(spec, [STANDINGS[3] as Standing]); // Aidan O'Connell
  expect(p.rows).toContain("Aidan O&#x27;Connell");
});
