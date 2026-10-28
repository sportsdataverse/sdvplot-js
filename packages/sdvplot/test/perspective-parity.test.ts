// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { resetWarnings, setWarningHandler } from "../src/errors.js";
import {
  type PerspectiveConfigOptions,
  type PerspectiveLogoOptions,
  perspectiveConfig,
  perspectiveLogoColumn,
} from "../src/perspective.js";
import "./_fixtures.js";

/**
 * Parity with sdvplot (Python): fixtures/perspective/oracle.json holds `perspective_sdv_config`'s answers on real
 * frames (tools/oracle/perspective.py; provenance in fixtures/perspective/README.md). The JavaScript config must equal
 * each one, key order included (what `JSON.stringify` writes), with the rows' types given as the frame's schema and
 * worked out from the rows alike, and warn as often. A case with a registry `theme` carries the spec Python read
 * (`theme_spec`, `table_theme_spec(theme, mode)`): sdvplot cannot resolve a theme itself (sdvtables' `tableThemeSpec`
 * does, and packages/sdvtables/test/table-theme-spec.test.ts runs these cases with it), so the spec is passed as is.
 * `logo_columns` holds `perspective_logo_column`'s answers, read from the logo manifest; `perspectiveLogoColumn` reads
 * this package's bundled index instead, and must give the same rows (column order and nulls included) and warn as often.
 */
const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/perspective/oracle.json");
const text = readFileSync(FILE, "utf8");
type Case = {
  name: string;
  options: Record<string, unknown>;
  schema: NonNullable<PerspectiveConfigOptions["schema"]>;
  rows: Record<string, unknown>[];
  config: unknown;
  warnings: string[];
  theme_spec?: NonNullable<PerspectiveConfigOptions["theme"]>;
};
type LogoCase = {
  name: string;
  team_col: string;
  options: Record<string, unknown>;
  rows: Record<string, unknown>[];
  result: Record<string, unknown>[];
  warnings: string[];
};
const oracle = JSON.parse(text) as { meta: Record<string, string>; cases: Case[]; logo_columns: LogoCase[] };

/** Python's keyword arguments, in JavaScript's names. */
function options(c: Case): PerspectiveConfigOptions {
  const names: Record<string, string> = { team_col: "teamCol", logo_col: "logoCol", id_system: "idSystem" };
  return Object.fromEntries(
    Object.entries(c.options).map(([k, v]) => [names[k] ?? k, k === "theme" ? c.theme_spec : v]),
  ) as unknown as PerspectiveConfigOptions;
}

afterEach(() => setWarningHandler(null));

describe("perspectiveConfig equals Python's perspective_sdv_config", () => {
  test("the fixture is the recorded one, from sdvplot's perspective.py of 519695e2 on perspective-python 5.5.1", () => {
    expect(createHash("sha256").update(readFileSync(FILE)).digest("hex")).toBe(
      "6844c52bcdab5b7e358c41c763f47dc6f4a7abdb4f68ff68f4faf483eafe8f92",
    );
    expect(oracle.meta).toMatchObject({
      perspective_py_commit: "519695e2ee4b968b76bd7f2e167116e8ab81ec8a",
      perspective_python: "5.5.1",
    });
    // what the parity has to cover: the grid, a split chart and a scatter, light and dark, numeric team ids and a null
    const has = (f: (c: Case) => boolean) => oracle.cases.some(f);
    const o = (c: Case, k: string) => c.options[k];
    for (const plugin of [undefined, "Y Bar", "X/Y Scatter"])
      for (const mode of [undefined, "dark"])
        expect(
          has((c) => o(c, "plugin") === plugin && o(c, "mode") === mode),
          `${plugin} ${mode}`,
        ).toBe(true);
    expect(
      has((c) => c.schema?.[o(c, "team_col") as string] === "integer" && o(c, "plugin") === undefined),
    ).toBe(true);
    expect(
      has((c) => c.schema?.[o(c, "team_col") as string] === "integer" && o(c, "plugin") === "Y Bar"),
    ).toBe(true);
    expect(has((c) => c.rows.some((r) => r[o(c, "team_col") as string] === null))).toBe(true);
    // a registry theme on the grid, light and dark, with a numeric face of its own, and on a chart (which takes none)
    for (const mode of [undefined, "dark"])
      expect(
        has((c) => o(c, "theme") !== undefined && o(c, "plugin") === undefined && o(c, "mode") === mode),
      ).toBe(true);
    expect(has((c) => JSON.stringify(c.config).includes('"font_family":"Roboto Mono"'))).toBe(true);
    expect(has((c) => o(c, "theme") !== undefined && o(c, "plugin") === "Y Bar")).toBe(true);
  });

  for (const c of oracle.cases)
    for (const given of [true, false])
      test(`${c.name}, ${given ? "the frame's schema given" : "the types worked out from the rows"}`, () => {
        const warned: string[] = [];
        resetWarnings();
        setWarningHandler((m) => warned.push(m));
        const o = options(c);
        const got = perspectiveConfig(c.rows, given ? { ...o, schema: c.schema } : o);
        // no rows and no schema: no column is known, so there is nothing to format (Python's frame keeps its columns,
        // so its config holds their number formats: give the table's schema to get those)
        const want =
          c.rows.length === 0 && !given ? { ...(c.config as object), columns_config: {} } : c.config;
        expect(got).toEqual(want);
        expect(JSON.stringify(got)).toBe(JSON.stringify(want));
        expect(warned).toHaveLength(c.warnings.length);
        // the one warning of sdvplot's own wording is word for word Python's
        const own = c.warnings.filter((w) => w.startsWith("no team colors"));
        expect(warned.filter((w) => w.startsWith("no team colors"))).toEqual(own);
      });
});

describe("perspectiveLogoColumn equals Python's perspective_logo_column", () => {
  test("the logo columns cover string and numeric teams, unresolved and null ones, a team with no logo, a variant, a name and seasons", () => {
    expect(oracle.meta).toMatchObject({
      manifest_etag: '"2b13d9cab12913e507f4b72d702562a7"',
      manifest_last_modified: "Thu, 01 Oct 2026 07:44:07 GMT",
    });
    const cases = oracle.logo_columns;
    const has = (f: (c: LogoCase) => boolean) => cases.some(f);
    expect(has((c) => typeof c.rows[0]?.[c.team_col] === "number")).toBe(true);
    expect(has((c) => c.rows.some((r) => r[c.team_col] === null))).toBe(true);
    expect(has((c) => c.warnings.some((w) => /did not resolve/.test(w)))).toBe(true);
    expect(has((c) => c.warnings.some((w) => /no logo archived/.test(w)))).toBe(true);
    expect(has((c) => c.options.variant === "dark")).toBe(true);
    expect(has((c) => c.options.name !== undefined)).toBe(true);
    expect(cases.filter((c) => c.options.season !== undefined)).toHaveLength(2);
  });

  for (const c of oracle.logo_columns)
    test(c.name, () => {
      const warned: string[] = [];
      resetWarnings();
      setWarningHandler((m) => warned.push(m));
      const names: Record<string, string> = { id_system: "idSystem" };
      const o = Object.fromEntries(
        Object.entries(c.options).map(([k, v]) => [names[k] ?? k, v]),
      ) as unknown as PerspectiveLogoOptions;
      const got = perspectiveLogoColumn(c.rows, c.team_col, o);
      expect(got).toEqual(c.result);
      expect(JSON.stringify(got)).toBe(JSON.stringify(c.result));
      expect(warned).toHaveLength(c.warnings.length);
    });
});
