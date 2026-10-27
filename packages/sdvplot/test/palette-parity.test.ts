// colorPalette (the shared team palette behind every adapter's teamColorPalette) against sdvplot (Python): the
// colours perspective._palette and pydeck._end_colors give for the same values, written offline by
// tools/oracle/palette.py into fixtures/palette/oracle.json (provenance in fixtures/palette/README.md).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { colorPalette } from "../src/_web.js";
import { setWarningHandler } from "../src/index.js";
import type { IdSystem, League, Which } from "../src/types.js";
import "./_fixtures.js"; // preloads every league

const BYTES = readFileSync(new URL("../../../fixtures/palette/oracle.json", import.meta.url));
interface Case {
  league: League;
  values: (string | number)[];
  season: number | null;
  idSystem: IdSystem;
  which: Which;
  background: string | null;
  colors: string[];
}
const { meta, cases } = JSON.parse(BYTES.toString("utf8")) as {
  meta: Record<string, string>;
  cases: Case[];
};

test("the fixture is the one sdvplot 0.1.1 (fc6c77ad) wrote", () => {
  expect(createHash("sha256").update(BYTES).digest("hex")).toBe(
    "f0c5ef590f8331ac0d24ca9597f675eeec1b8b035a8c0f729ee7c10f07f58b58",
  );
  expect([meta.sdvplot_version, meta.sdvplot_commit]).toEqual(["0.1.1", "fc6c77ad"]);
  // what the cases exercise: aliases sharing a colour, unresolved values in grey, both colours, no background
  const flat = (c: Case) => c.values.map(String);
  expect(cases.some((c) => new Set(c.colors).size < new Set(flat(c)).size && c.background !== null)).toBe(
    true,
  );
  expect(cases.some((c) => c.colors.filter((x) => x === "#808080").length >= 2)).toBe(true);
  expect(new Set(cases.map((c) => c.which))).toEqual(new Set(["primary", "secondary"]));
  expect(cases.some((c) => c.background === null)).toBe(true);
});

describe("colorPalette equals sdvplot's palette", () => {
  test.each(
    cases.map((c, i) => [i, `${c.league} ${c.which} on ${c.background ?? "no background"}`, c] as const),
  )("case %i: %s", (_i, _name, c) => {
    setWarningHandler(() => {});
    try {
      const got = colorPalette(c.league, c.values, {
        which: c.which,
        idSystem: c.idSystem,
        ...(c.season === null ? {} : { season: c.season }),
        ...(c.background === null ? {} : { background: c.background }),
      });
      expect(got).toEqual(c.colors);
    } finally {
      setWarningHandler(null);
    }
  });
});
