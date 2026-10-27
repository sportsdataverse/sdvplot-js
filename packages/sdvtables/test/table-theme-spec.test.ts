// @vitest-environment node
import { readFileSync } from "node:fs";
import { preloadAll, resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { type PerspectiveConfigOptions, perspectiveConfig } from "@sportsdataverse/sdvplot/perspective";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { TableSpecError } from "../src/errors.js";
import { listTableThemes, tableThemeSpec } from "../src/themes/registry.js";

/**
 * sdvplot (Python)'s answers, written offline by tools/oracle/perspective.py (provenance and sha256 pin:
 * fixtures/perspective/README.md, packages/sdvplot/test/perspective-parity.test.ts): `table_theme_spec` on a few
 * themes, every field, and `perspective_sdv_config` with a registry `theme`, which here takes sdvtables' own spec.
 */
type Oracle = {
  cases: {
    name: string;
    options: Record<string, unknown>;
    schema: NonNullable<PerspectiveConfigOptions["schema"]>;
    rows: Record<string, unknown>[];
    config: unknown;
    warnings: string[];
  }[];
  table_theme_specs: { name: string; mode: "light" | "dark"; spec: Record<string, unknown> }[];
};
const oracle = JSON.parse(
  readFileSync(new URL("../../../fixtures/perspective/oracle.json", import.meta.url), "utf8"),
) as Oracle;

/** Python's spec in JavaScript's names: `dark_policy` is `darkPolicy`, in the same place. */
const js = (spec: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(spec).map(([k, v]) => [k === "dark_policy" ? "darkPolicy" : k, v]));

beforeAll(() => preloadAll());
afterEach(() => setWarningHandler(null));

describe("tableThemeSpec equals Python's table_theme_spec", () => {
  test("the oracle covers light and dark, a light-only theme and a numeric face of its own", () => {
    const specs = oracle.table_theme_specs;
    expect(specs.some((s) => s.mode === "dark")).toBe(true);
    expect(specs.some((s) => s.spec.dark_policy === "none")).toBe(true);
    expect(specs.some((s) => s.spec.dark_policy === "derived" && s.mode === "dark")).toBe(true);
    expect(
      specs.some(
        (s) =>
          (s.spec.fonts as Record<string, unknown>).numeric !==
          (s.spec.fonts as Record<string, unknown>).body,
      ),
    ).toBe(true);
  });

  for (const { name, mode, spec } of oracle.table_theme_specs)
    test(`${name} ${mode}: every field, key order included`, () => {
      const got = tableThemeSpec(name, mode);
      expect(got).toEqual(js(spec));
      expect(JSON.stringify(got)).toBe(JSON.stringify(js(spec)));
    });

  test("light is the default mode", () => {
    expect(tableThemeSpec("datagolf")).toEqual(tableThemeSpec("datagolf", "light"));
  });
});

describe("perspectiveConfig with tableThemeSpec equals perspective_sdv_config with a theme", () => {
  const names: Record<string, string> = { team_col: "teamCol", logo_col: "logoCol" };
  for (const c of oracle.cases.filter((c) => c.options.theme !== undefined))
    test(c.name, () => {
      const warned: string[] = [];
      resetWarnings();
      setWarningHandler((m) => warned.push(m));
      const mode = (c.options.mode ?? "light") as "light" | "dark";
      const o = Object.fromEntries(
        Object.entries(c.options).map(([k, v]) => [
          names[k] ?? k,
          k === "theme" ? tableThemeSpec(v as string, mode) : v,
        ]),
      ) as unknown as PerspectiveConfigOptions;
      const got = perspectiveConfig(c.rows, { ...o, schema: c.schema });
      expect(JSON.stringify(got)).toBe(JSON.stringify(c.config));
      expect(warned).toHaveLength(c.warnings.length);
    });
});

describe("tableThemeSpec errors and copies", () => {
  const err = (f: () => unknown): string => {
    try {
      f();
    } catch (e) {
      expect(e).toBeInstanceOf(TableSpecError);
      return (e as Error).message;
    }
    throw new Error("no error");
  };

  test("an unknown name, with close matches when there are any", () => {
    expect(err(() => tableThemeSpec("datagolff"))).toMatch(
      /^unknown table theme "datagolff"; did you mean "datagolf"/,
    );
    const far = err(() => tableThemeSpec("zzzzzzzzzzzz"));
    expect(far).toMatch(/^unknown table theme "zzzzzzzzzzzz" \(see listTableThemes\(\)\)$/);
    // a house theme is a theme, not a registry theme
    expect(err(() => tableThemeSpec("sdv"))).toMatch(/unknown table theme "sdv"/);
  });

  test("a reactablefmtr name points at its port and at the surveyed site look", () => {
    for (const name of ["espn", "fivethirtyeight", "pff"])
      expect(err(() => tableThemeSpec(name))).toBe(
        `"${name}" is a reactablefmtr port, not a registry theme: use the "fmtr-${name}" theme, or "${name}-site" for the surveyed site look`,
      );
  });

  test("a bad mode, before the name", () => {
    expect(err(() => tableThemeSpec("datagolf", "dim" as "dark"))).toBe(
      `mode must be "light" or "dark", not "dim"`,
    );
    expect(err(() => tableThemeSpec("nope", "dim" as "dark"))).toMatch(/^mode must be/);
  });

  test("dark on a light-only theme names dark-capable themes of its category, else of any", () => {
    expect(err(() => tableThemeSpec("ft-markets-data", "dark"))).toMatch(
      /^theme "ft-markets-data" is light-only; dark-capable themes in category "finance": [\w-]+, [\w-]+, [\w-]+$/,
    );
    expect(err(() => tableThemeSpec("nejm", "dark"))).toMatch(
      /^theme "nejm" is light-only; no dark-capable themes in category "journal"; try: [\w-]+, [\w-]+, [\w-]+$/,
    );
  });

  test("every theme in every mode it has: no {key} left in the structure, the palette complete", () => {
    for (const { id, darkPolicy } of listTableThemes())
      for (const mode of darkPolicy === "none" ? (["light"] as const) : (["light", "dark"] as const)) {
        const s = tableThemeSpec(id, mode);
        expect(JSON.stringify(s.structure), `${id} ${mode}`).not.toMatch(/\{\w+\}/);
        for (const k of ["page", "labelBg", "labelColor", "neg", "pos"] as const)
          expect(s.palette[k], `${id} ${mode} ${k}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
  });

  test("a spec is a copy: changing one changes no later one", () => {
    const a = tableThemeSpec("dunks-and-threes");
    (a.structure.heatColumns as string[]).push("mutated");
    (a.fonts as { body: string }).body = "mutated";
    const b = tableThemeSpec("dunks-and-threes");
    expect(b.structure.heatColumns).not.toContain("mutated");
    expect(b.fonts.body).not.toBe("mutated");
  });
});
