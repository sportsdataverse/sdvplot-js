// @vitest-environment happy-dom
import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { defineTable } from "../../src/define.js";
import { themePreview } from "../../src/html/index.js";
import { BASE_CSS } from "../../src/themes/base-css.js";
import { THEME_NAMES } from "../../src/themes/index.js";
import { STANDINGS, type Standing } from "../fixtures/standings.js";

// great_tables draws the title and the subtitle on separate heading rows in every theme. The caption holds two
// spans, so the base sheet makes the subtitle a block; tufte and booktabs set no display and ran "AFC2024 regular season".
const spec = defineTable<Standing>()
  .columns((c) => [c.text("team"), c.int("wins")])
  .title("AFC")
  .subtitle("2024 regular season")
  .build();

beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll(); // sdvTeam (league nfl) resolves team colours
});

test("the base sheet puts the subtitle on its own line", () => {
  expect(BASE_CSS(".x")).toMatch(/^\.x \.sdvt-subtitle\{[^}]*display:block/m);
});

test.each([...THEME_NAMES])("%s: the subtitle renders on its own line", (name) => {
  // without the fonts <link>: happy-dom would fetch it, and unit tests make no network calls
  document.body.innerHTML = (themePreview(spec, STANDINGS, [name])[name] as string).replace(
    /^<link[^>]*>\n/,
    "",
  );
  const sub = document.querySelector(".sdvt-subtitle");
  if (sub === null) throw new Error("no subtitle");
  expect(getComputedStyle(sub).display).toBe("block");
});
