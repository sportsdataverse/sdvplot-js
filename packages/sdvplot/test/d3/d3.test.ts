// @vitest-environment jsdom
import { scaleLinear, select } from "d3";
import { afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import { appendLogos, appendSurface, teamColorScale } from "../../src/d3/index.js";
import { InputError, loadLeague, resetWarnings, setWarningHandler, teamColorsSync } from "../../src/index.js";
import { drawnMarks } from "../../src/testing/index.js";

beforeAll(async () => {
  await loadLeague("nfl");
  await loadLeague("nba");
});
let warned: string[] = [];
beforeEach(() => {
  warned = [];
  resetWarnings();
  setWarningHandler((m) => warned.push(String(m)));
});
afterEach(() => setWarningHandler(null));

const x = scaleLinear().domain([0, 30]).range([0, 600]);
const y = scaleLinear().domain([-10, 0]).range([350, 0]);
const pos = { x: (v: unknown) => x(Number(v)), y: (v: unknown) => y(Number(v)) };

test("appendLogos draws data-stamped images sized by frameHeight", () => {
  const svg = select(document.body).append("svg");
  appendLogos(svg, [10, 20], [-3, -7], ["LV", "LAR"], {
    league: "nfl",
    ...pos,
    frameHeight: 350,
    height: 0.2,
  });
  const m = drawnMarks(svg.node() as SVGSVGElement);
  expect(m.map((d) => [d.x, d.y])).toEqual([
    [10, -3],
    [20, -7],
  ]);
  expect(m[0]?.height).toBeCloseTo(0.2, 6);
  expect(Number(svg.select("image").attr("height"))).toBeCloseTo(70, 6);
});

test("frameHeight must be a finite number > 0", () => {
  for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const svg = select(document.body).append("svg");
    expect(() => appendLogos(svg, [10], [-3], ["LV"], { league: "nfl", ...pos, frameHeight: bad })).toThrow(
      /frameHeight is the plot height in px/,
    );
  }
});

test("a null or NaN position draws no image and writes no NaN", () => {
  const svg = select(document.body).append("svg");
  appendLogos(svg, [10, null, Number.NaN], [-3, -7, -5], ["LV", "LAR", "LAC"], {
    league: "nfl",
    ...pos,
    frameHeight: 350,
  });
  expect(svg.selectAll("image").size()).toBe(1);
  expect(svg.html()).not.toContain("NaN");
  expect(warned.length).toBe(1);
});

test("teamColorScale is a d3 ordinal with unknown -> naValue", () => {
  const s = teamColorScale("nfl", { values: ["KC", "ZZZ"] });
  expect(s("KC")).toBe(teamColorsSync("nfl", ["KC"], { which: "primary" })[0]);
  expect(s("ZZZ")).toBe("grey");
});

test("appendSurface paints the lane for a team and draws through the scales", () => {
  const svg = select(document.body).append("svg");
  const g = appendSurface(svg, "nba", { team: "BOS", x: (v) => v * 10 + 500, y: (v) => 250 - v * 10 });
  const lane = g.select<SVGPathElement>("path[data-feature='painted_area']");
  expect((lane.attr("fill") ?? "").toLowerCase()).toBe(
    (teamColorsSync("nba", ["BOS"], { which: "primary" })[0] ?? "").toLowerCase(),
  );
});

test("appendSurface throws InputError for a league with no surface", () => {
  const svg = select(document.body).append("svg");
  expect(() => appendSurface(svg, "mlb", { x: (v) => v, y: (v) => v })).toThrow(InputError);
});
