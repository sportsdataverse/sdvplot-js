import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { contrast } from "@sportsdataverse/sdvplot";
import { describe, expect, it } from "vitest";
import { FMTR_NAMES } from "../src/themes/fmtr.js";
import { THEMES } from "../src/themes/index.js";

const dataUrl = (f: string) => new URL(`../data/${f}`, import.meta.url);
const raw = readFileSync(dataUrl("table_themes.json"));
type Palette = Record<string, string>;
type Spec = { darkPolicy: string; light: Palette; dark: Palette | null; structure: Record<string, unknown> };
const reg = JSON.parse(raw.toString("utf8")) as {
  version: string;
  count: number;
  themes: Record<string, Spec>;
};
const entries = Object.entries(reg.themes);

const PALETTE =
  "page bg text muted accent rule hline labelBg labelColor stripe summaryBg link pos neg posBg negBg heatLow heatMid heatHigh".split(
    " ",
  );
const HOUSE_NAMES = Object.keys(THEMES).filter((k) => !k.startsWith("fmtr-")); // the house themes (20 keys today)
const FMTR_BARE = FMTR_NAMES.flatMap((n) => [n, n.replace(/_/g, "-")]);

describe("table_themes.json registry", () => {
  it("has 122 entries", () => {
    expect(reg.count).toBe(122);
    expect(entries).toHaveLength(122);
  });

  it("ids are unique against house and reactablefmtr names", () => {
    for (const [id] of entries) {
      expect(HOUSE_NAMES, id).not.toContain(id);
      expect(FMTR_BARE, id).not.toContain(id);
      expect(id.startsWith("reactablefmtr-"), id).toBe(false);
    }
    for (const id of ["espn-site", "fivethirtyeight-site", "pff-site"]) expect(reg.themes[id]).toBeDefined();
  });

  it("darkPolicy none <=> dark null; palettes are #rrggbb", () => {
    for (const [id, s] of entries) {
      expect(s.darkPolicy === "none", id).toBe(s.dark === null);
      for (const p of [s.light, s.dark]) {
        if (!p) continue;
        for (const k of PALETTE) expect(p[k], `${id}.${k}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("border {refs} are palette keys", () => {
    for (const [id, s] of entries)
      for (const [field, v] of Object.entries(s.structure))
        if (typeof v === "string")
          for (const m of v.matchAll(/\{(\w+)\}/g)) expect(PALETTE, `${id}.${field}`).toContain(m[1]);
  });

  it("pos/neg text is >= 4.5:1 on bg, posBg, negBg", () => {
    for (const [id, s] of entries)
      for (const [mode, p] of [
        ["light", s.light],
        ["dark", s.dark],
      ] as const) {
        if (!p) continue;
        for (const [fg, bgs] of [
          ["pos", ["bg", "posBg"]],
          ["neg", ["bg", "negBg"]],
        ] as const)
          for (const b of bgs)
            expect(
              contrast(p[fg] as string, p[b] as string),
              `${id} ${mode} ${fg} on ${b}`,
            ).toBeGreaterThanOrEqual(4.5);
      }
  });

  it("sha256 file matches the JSON bytes", () => {
    expect(readFileSync(dataUrl("table_themes.json.sha256"), "utf8").trim()).toBe(
      createHash("sha256").update(raw).digest("hex"),
    );
    expect(raw.includes(13)).toBe(false); // no CR
  });
});
