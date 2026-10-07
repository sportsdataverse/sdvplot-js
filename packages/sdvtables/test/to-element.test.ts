// test/to-element.test.ts
// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableCSSFileLoading":true,"handleDisabledFileLoadingAsSuccess":true}}
import { preloadAll } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { fontsLink, toElement } from "../src/html/index.js";
import { resolveTheme } from "../src/themes/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";
beforeAll(() => preloadAll());
test("toElement returns the wrapper div with a live table", () => {
  const el = toElement(
    defineTable<Standing>()
      .columns((c) => [c.text("team")])
      .title("t")
      .build(),
    STANDINGS,
  );
  expect(el.tagName).toBe("DIV");
  expect(el.querySelectorAll("tbody tr").length).toBe(8);
  expect(el.querySelector("caption")?.textContent).toBe("t");
  expect(el.querySelector("th")?.getAttribute("scope")).toBe("col");
});
test("toElement puts the fonts <link> in <head> once per href (A100); the wrapper stays the return value", () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .theme("athletic")
    .build();
  const a = toElement(spec, STANDINGS);
  const b = toElement(spec, STANDINGS);
  expect(a.tagName).toBe("DIV");
  expect(b.querySelector("link")).toBeNull();
  const href = fontsLink(resolveTheme(spec.theme).fonts)
    .match(/href="([^"]+)"/)?.[1]
    ?.replace(/&amp;/g, "&");
  const links = Array.from(document.head.querySelectorAll("link")).filter(
    (l) => l.getAttribute("href") === href,
  );
  expect(href).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?family=Spline/);
  expect(links).toHaveLength(1); // two calls, one <link> (the first test's sdv link is a different href)
});
