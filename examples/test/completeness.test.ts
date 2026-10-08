import { existsSync, readdirSync } from "node:fs";
import { GT_ALIASES, THEME_NAMES } from "@sportsdataverse/sdvtables";
import type { ColumnKind, DecorationType } from "@sportsdataverse/sdvtables";
import { SPORTS, leagues } from "@sportsdataverse/sporty";
import { expect, test } from "vitest";
import { THEMES } from "../scripts/lib.js";
import { abs } from "../sources.js";
import { BROWSER } from "../src/browser.gen.js";
import { EXAMPLES } from "../src/registry.gen.js";

// sdvtables' own ColumnKind / DecorationType unions, spelled out because a type has no runtime value:
// `satisfies Record<…, 1>` is exhaustive both ways, so a kind or decoration added to or dropped from the spec
// fails `pnpm typecheck` here (it covers examples/test) before this test ever runs.
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
} satisfies Record<ColumnKind, 1>;
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
} satisfies Record<DecorationType, 1>;

const names = (dir: string): string[] =>
  existsSync(abs(`examples/src/${dir}`))
    ? readdirSync(abs(`examples/src/${dir}`))
        .map((f) => f.replace(/\.tsx?$/, ""))
        .sort()
    : [];

test("every column kind and every decoration has a hand-written example named after it, tagged with its R names", () => {
  expect(names("sdvtables/kinds")).toEqual(Object.keys(KINDS).sort());
  expect(names("sdvtables/decorations")).toEqual(Object.keys(DECORATIONS).sort());
  // The gallery is searchable by the sdvplotR / gtUtils names: each example carries every GT_ALIASES name whose
  // target is its kind (c.<kind>) or decoration (builder.<type>).
  for (const [area, tag, prefix] of [
    ["kinds", "kind", "c."],
    ["decorations", "decoration", "builder."],
  ] as const)
    for (const e of EXAMPLES.filter((x) => x.id.startsWith(`sdvtables/${area}/`))) {
      const name = e.id.slice(`sdvtables/${area}/`.length);
      const aliases = Object.keys(GT_ALIASES).filter((n) => GT_ALIASES[n]?.target === `${prefix}${name}`);
      expect(e.tags, e.id).toEqual(expect.arrayContaining([tag, name, ...aliases]));
    }
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

/** Adapter examples whose output is the point, so the page keeps the static copy, with the reason. */
const STATIC_ONLY: Readonly<Record<string, string>> = {
  "sdvplot/plotly/embed-sources": "its output is the data URIs, a table; there is no chart to draw",
  "sdvplot/vega/embed-sources":
    "the self-contained SVG file is the point; in a browser the logos would be refetched",
  "sdvplot/echarts/embed-sources":
    "the self-contained SVG file is the point; in a browser the logos would be refetched",
};

test("every Plotly, Vega, ECharts and Chart.js example is drawn by its library in the browser", () => {
  const adapters = EXAMPLES.filter((e) => /^sdvplot\/(plotly|vega|echarts|chartjs)\//.test(e.id)).map(
    (e) => e.id,
  );
  const upgraded = Object.keys(BROWSER);
  expect(adapters.filter((id) => !upgraded.includes(id) && !(id in STATIC_ONLY))).toEqual([]);
  expect(Object.keys(STATIC_ONLY).filter((id) => !adapters.includes(id) || upgraded.includes(id))).toEqual(
    [],
  );
});
