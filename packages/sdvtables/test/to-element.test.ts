// test/to-element.test.ts
// @vitest-environment happy-dom
import { preloadAll } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { toElement } from "../src/html/index.js";
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
