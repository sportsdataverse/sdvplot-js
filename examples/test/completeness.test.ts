import { existsSync, readdirSync } from "node:fs";
import { THEME_NAMES } from "@sportsdataverse/sdvtables";
import type { ColumnSpec, Decoration } from "@sportsdataverse/sdvtables";
import { SPORTS, leagues } from "@sportsdataverse/sporty";
import { expect, test } from "vitest";
import { THEMES } from "../scripts/lib.js";
import { abs } from "../sources.js";
import { EXAMPLES } from "../src/registry.gen.js";

type Row = Record<string, unknown>;
// `satisfies Record<…, 1>` is exhaustive both ways: a kind or decoration added to the spec is a compile error here.
const KINDS = {
  text: 1,
  num: 1,
  int: 1,
  pct: 1,
  rank: 1,
  delta: 1,
  tally: 1,
  logo: 1,
  wordmark: 1,
  headshot: 1,
  colorPills: 1,
  colorRanks: 1,
  colorResults: 1,
  percentileBar: 1,
  indicatorBox: 1,
  highlight: 1,
  highlightNa: 1,
  mergeStackTeamColor: 1,
  teamColorBar: 1,
  teamColorBg: 1,
  image: 1,
} satisfies Record<ColumnSpec<Row>["kind"], 1>;
const DECORATIONS = {
  title: 1,
  subtitle: 1,
  titleHeader: 1,
  sourceNote: 1,
  caption538: 1,
  groupBy: 1,
  groupStripes: 1,
  rowAccent: 1,
  boldRows: 1,
  spotlight: 1,
  cutline: 1,
  borderGrid: 1,
  borderBars: 1,
  legendContinuous: 1,
  legendDiscrete: 1,
  significance: 1,
  outliers: 1,
  scaleNote: 1,
  socialTag: 1,
  watermark: 1,
  wrapLabels: 1,
  marginalia: 1,
  snake: 1,
  tiers: 1,
  font: 1,
} satisfies Record<Decoration<Row>["type"], 1>;

const names = (dir: string): string[] =>
  existsSync(abs(`examples/src/${dir}`))
    ? readdirSync(abs(`examples/src/${dir}`))
        .map((f) => f.replace(/\.tsx?$/, ""))
        .sort()
    : [];

// Expected to fail until Task 8 writes examples/src/sdvtables/{kinds,decorations}; Task 8 turns it into test().
test.fails("every column kind and every decoration has a hand-written example named after it", () => {
  expect(names("sdvtables/kinds")).toEqual(Object.keys(KINDS).sort());
  expect(names("sdvtables/decorations")).toEqual(Object.keys(DECORATIONS).sort());
});

test("the theme family is THEME_NAMES", () => {
  expect([...THEMES].sort()).toEqual([...THEME_NAMES].sort());
});

test("the surface family is every league of every sport surface() draws, custom templates aside", () => {
  // From sporty's own runtime tables, not the generator's reading of the spec files: a sport or league
  // sporty adds (or the generator misses) fails here by name.
  const expected = SPORTS.flatMap((sport) =>
    leagues(sport)
      .filter((l) => l !== "custom")
      .map((l) => `${sport}: ${l}`),
  ).sort();
  const family = EXAMPLES.filter((e) => e.id.startsWith("sporty/surfaces/"));
  expect(family.map((e) => `${e.tags[1]}: ${e.tags[2]}`).sort()).toEqual(expected);
  expect(family.map((e) => e.title).sort()).toEqual(expected);
});
