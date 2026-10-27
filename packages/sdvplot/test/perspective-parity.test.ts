// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { resetWarnings, setWarningHandler } from "../src/errors.js";
import { type PerspectiveConfigOptions, perspectiveConfig } from "../src/perspective.js";
import "./_fixtures.js";

/**
 * Parity with sdvplot (Python): fixtures/perspective/oracle.json holds `perspective_sdv_config`'s answers on real
 * frames (tools/oracle/perspective.py; provenance in fixtures/perspective/README.md). The JavaScript config must equal
 * each one, key order included (what `JSON.stringify` writes), with the rows' types given as the frame's schema and
 * worked out from the rows alike, and warn as often.
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
};
const oracle = JSON.parse(text) as { meta: Record<string, string>; cases: Case[] };

/** Python's keyword arguments, in JavaScript's names. */
function options(c: Case): PerspectiveConfigOptions {
  const names: Record<string, string> = { team_col: "teamCol", logo_col: "logoCol", id_system: "idSystem" };
  return Object.fromEntries(
    Object.entries(c.options).map(([k, v]) => [names[k] ?? k, v]),
  ) as unknown as PerspectiveConfigOptions;
}

afterEach(() => setWarningHandler(null));

describe("perspectiveConfig equals Python's perspective_sdv_config", () => {
  test("the fixture is the recorded one, from sdvplot's perspective.py of 519695e2 on perspective-python 5.5.1", () => {
    expect(createHash("sha256").update(readFileSync(FILE)).digest("hex")).toBe(
      "b44c307aa773177387d0e5bf1c58621dcd82dc09fdb38635bf7f4806e541970f",
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
  });

  for (const c of oracle.cases)
    for (const given of [true, false])
      test(`${c.name}, ${given ? "the frame's schema given" : "the types worked out from the rows"}`, () => {
        const warned: string[] = [];
        resetWarnings();
        setWarningHandler((m) => warned.push(m));
        const o = options(c);
        const got = perspectiveConfig(c.rows, given ? { ...o, schema: c.schema } : o);
        expect(got).toEqual(c.config);
        expect(JSON.stringify(got)).toBe(JSON.stringify(c.config));
        expect(warned).toHaveLength(c.warnings.length);
        // the one warning of sdvplot's own wording is word for word Python's
        const own = c.warnings.filter((w) => w.startsWith("no team colors"));
        expect(warned.filter((w) => w.startsWith("no team colors"))).toEqual(own);
      });
});
