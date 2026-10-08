import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, describe, expect, onTestFailed, test } from "vitest";
import { defineTable } from "../src/define.js";
import { htmlToPNG } from "../src/export/index.js";
import { themePreview } from "../src/html/index.js";
import { THEMES, THEME_NAMES } from "../src/index.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";

// spec §7 (A46): one playwright visual pass per theme, uploaded as an artifact and never a gate. It runs when
// SDV_THEME_PASS_DIR names the output folder, or under `pnpm --filter @sportsdataverse/sdvtables render:themes`
// (pnpm sets npm_lifecycle_event to the script name), which writes packages/sdvtables/theme-pass/.
const DIR =
  process.env.SDV_THEME_PASS_DIR ??
  (process.env.npm_lifecycle_event === "render:themes" ? "theme-pass" : undefined);
/** The themes the pass renders: every registered theme. */
const PASS_THEMES: readonly string[] = THEME_NAMES;
/** Phase 4's snapshot table (title, subtitle, groupBy, source note) plus two numeric columns, on all 8 STANDINGS rows. */
const PASS = defineTable<Standing>()
  .columns((c) => [
    c.text("team"),
    c.text("qb", { label: "Quarterback", align: "left" }),
    c.int("wins"),
    c.num("net_epa", { digits: 3 }),
  ])
  .title("AFC")
  .subtitle("2024 regular season")
  .groupBy("division")
  .sourceNote("Source: nflverse")
  .build();

beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll(); // themePreview shows sdvTeam with league nfl
});

test("A46: the visual pass renders exactly the exported theme registry, so a new theme cannot be skipped", () => {
  expect([...PASS_THEMES]).toEqual(Object.keys(THEMES));
  expect(Object.keys(themePreview(PASS, STANDINGS, PASS_THEMES))).toEqual(Object.keys(THEMES));
});

describe.skipIf(DIR === undefined)("A46: one PNG per theme (render:themes, SDV_THEME_PASS_DIR)", () => {
  test.each([...PASS_THEMES])(
    "%s",
    async (name) => {
      const dir = resolve(DIR as string);
      await mkdir(dir, { recursive: true });
      // a failed theme (a throw or a timeout) leaves <name>.error.txt beside the PNGs; the CI summary names it
      onTestFailed(({ errors }) =>
        writeFile(join(dir, `${name}.error.txt`), `${errors?.[0]?.message ?? "failed"}\n`),
      );
      const html = themePreview(PASS, STANDINGS, [name], { n: STANDINGS.length })[name] as string;
      // tableToPNG(spec, rows) is htmlToPNG(renderHTML(spec, rows)); themePreview returns that HTML, themed
      const png = await htmlToPNG(html, { file: join(dir, `${name}.png`) });
      expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    },
    60_000,
  );
});
