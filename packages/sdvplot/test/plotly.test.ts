import { beforeEach, describe, expect, test, vi } from "vitest";
import { STANDINGS } from "../../sdvtables/test/fixtures/standings.js";
import { InputError, UnsupportedTargetError } from "../src/errors.js";
import { resetWarnings, resolveSync, setWarningHandler } from "../src/index.js";
import {
  type PlotlyAxis,
  type PlotlyFigure,
  drawnAxisMarks,
  drawnMarks,
  teamColorway,
  visibleAxisLabels,
  withAxisLogos,
  withHeadshots,
  withLogos,
  withWordmarks,
} from "../src/plotly.js";
import { BUF, KC, ROWS, ROWS_UNKNOWN } from "./_fixtures.js";

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own

const scatter = (): PlotlyFigure => ({ data: [{ type: "scatter", x: [10, 20], y: [-3, -7] }], layout: {} });
const ID = (t: string) => resolveSync(t, "nfl") as string;

describe("withLogos on a scatter", () => {
  test("draws each team at its point with height as a fraction of the pinned y span and returns a NEW figure", () => {
    const fig = scatter();
    const out = withLogos(fig, ROWS, { x: "x", y: "y", team: "team", league: "nfl", height: 0.1 });
    expect(out).not.toBe(fig);
    expect(drawnMarks(out).map(([id, x, y, h]) => [id, x, y, h])).toEqual([
      [ID(KC), 10, -3, 0.1],
      [ID(BUF), 20, -7, 0.1],
    ]);
    const im = out.layout!.images![0]!;
    expect(im).toMatchObject({
      xref: "x",
      yref: "y",
      sizing: "contain",
      xanchor: "center",
      yanchor: "middle",
      layer: "above",
      name: `sdvplot:logo:${ID(KC)}`,
    });
    expect(im.source).toMatch(/^https:\/\//);
  });

  test("the input is not mutated", () => {
    const fig = scatter();
    const before = structuredClone(fig);
    withLogos(fig, ROWS, { x: "x", y: "y", team: "team", league: "nfl" });
    expect(fig).toEqual(before);
  });

  test("pinned ranges: data extent plus half a mark of room at each end, autorange off", () => {
    const out = withLogos({ data: [], layout: { width: 700, height: 450 } }, ROWS, {
      x: "x",
      y: "y",
      team: "team",
      league: "nfl",
      height: 0.1,
    });
    const y = out.layout!.yaxis!;
    // data y: -7..-3 → span 4 / (1 - 0.1) = 4.444…, centred on -5
    expect(y.autorange).toBe(false);
    expect(y.range![0]).toBeCloseTo(-5 - 4 / 0.9 / 2, 9);
    expect(y.range![1]).toBeCloseTo(-5 + 4 / 0.9 / 2, 9);
    expect(out.layout!.images![0]!.sizey).toBeCloseTo(0.1 * (4 / 0.9), 9);
    const [xlo, xhi] = out.layout!.xaxis!.range as [number, number];
    expect(out.layout!.images![0]!.sizex).toBeCloseTo(2 * Math.abs(xhi - xlo), 9);
  });

  test("a user-set range is kept and sizes the images", () => {
    // Review Focus 1
    const out = withLogos(
      { data: [], layout: { yaxis: { range: [-20, 0] }, xaxis: { range: [0, 100] } } },
      ROWS,
      {
        x: "x",
        y: "y",
        team: "team",
        league: "nfl",
        height: 0.25,
      },
    );
    expect(out.layout!.yaxis!.range).toEqual([-20, 0]);
    expect(out.layout!.xaxis!.range).toEqual([0, 100]);
    expect(out.layout!.images![0]!.sizey).toBeCloseTo(5, 9); // 0.25 × 20
  });

  test("a reversed axis stays reversed", () => {
    // Review Focus 2
    const out = withLogos({ data: [], layout: { yaxis: { autorange: "reversed" } } }, ROWS, {
      x: "x",
      y: "y",
      team: "team",
      league: "nfl",
    });
    const [lo, hi] = out.layout!.yaxis!.range as [number, number];
    expect(lo).toBeGreaterThan(hi);
    expect(drawnMarks(out)[0]![3]).toBeCloseTo(0.1, 9); // height is |sizey| / |span| regardless of direction
  });

  test("a bar chart keeps its zero baseline and whole edge bars in the pinned ranges", () => {
    const out = withLogos(
      { data: [{ type: "bar", x: [1, 2, 3], y: [5, 8, 2] }], layout: {} },
      [{ x: 1, y: 5, team: KC }],
      { x: "x", y: "y", team: "team", league: "nfl", height: 0.1 },
    );
    const [ylo] = out.layout!.yaxis!.range as [number, number];
    const [xlo, xhi] = out.layout!.xaxis!.range as [number, number];
    expect(ylo).toBeLessThan(0); // 0 is in the extent, then room was added below it
    expect(xlo).toBeLessThan(0.5); // half a bar width each side, then room
    expect(xhi).toBeGreaterThan(3.5);
  });

  test("stacked bars extend the extent to the stack ends", () => {
    const out = withLogos(
      {
        data: [
          { type: "bar", x: ["a", "b"], y: [5, 8] },
          { type: "bar", x: ["a", "b"], y: [5, 2] },
        ],
        layout: { barmode: "stack" },
      },
      [{ x: "a", y: 10, team: KC }],
      { x: "x", y: "y", team: "team", league: "nfl" },
    );
    expect((out.layout!.yaxis!.range as [number, number])[1]).toBeGreaterThan(10);
  });

  test("a category x axis places the logo at the category index and pins [-0.5, n-0.5] plus room", () => {
    const out = withLogos(
      { data: [{ type: "bar", x: ["KC", "BUF", "BAL"], y: [12, 10, 9] }], layout: {} },
      [{ x: "KC", y: 12, team: KC }],
      { x: "x", y: "y", team: "team", league: "nfl" },
    );
    expect(out.layout!.images![0]!.x).toBe(0);
    expect(drawnMarks(out)[0]![1]).toBe(0);
    const [xlo, xhi] = out.layout!.xaxis!.range as [number, number];
    expect(xlo).toBeLessThan(-0.5);
    expect(xhi).toBeGreaterThan(2.5);
  });

  test("a point whose category is not on the axis is skipped with one warning", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const out = withLogos(
      { data: [{ type: "bar", x: ["KC", "BUF"], y: [1, 2] }], layout: {} },
      [
        { x: "KC", y: 1, team: KC },
        { x: "NOPE", y: 2, team: BUF },
      ],
      { x: "x", y: "y", team: "team", league: "nfl" },
    );
    setWarningHandler(null);
    expect(drawnMarks(out)).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toMatch(/not on the axis/);
  });

  test("an unknown team is skipped with one warning; empty rows leave the axes alone", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const out = withLogos(scatter(), ROWS_UNKNOWN, { x: "x", y: "y", team: "team", league: "nfl" });
    setWarningHandler(null);
    expect(drawnMarks(out).map((m) => m[0])).toEqual([ID(KC)]);
    expect(spy).toHaveBeenCalledTimes(1);
    const empty = withLogos(scatter(), [], { x: "x", y: "y", team: "team", league: "nfl" });
    expect(empty.layout!.yaxis?.range).toBeUndefined();
  });

  test("bigint positions draw as numbers", () => {
    const out = withLogos(scatter(), [{ x: 10n, y: -3n, team: KC }], {
      x: "x",
      y: "y",
      team: "team",
      league: "nfl",
    });
    expect(drawnMarks(out).map((m) => m.slice(0, 3))).toEqual([[ID(KC), 10, -3]]);
  });

  test("unmeasurable traces and unsupported axes raise InputError naming the fix", () => {
    const o = { x: "x", y: "y", team: "team", league: "nfl" } as const;
    expect(() => withLogos({ data: [{ type: "heatmap" }], layout: {} }, ROWS, o)).toThrow(
      /cannot work out the x range of a heatmap trace; set it first/,
    );
    expect(() => withLogos({ data: [], layout: { yaxis: { type: "log" } } }, ROWS, o)).toThrow(
      /does not support log axes/,
    );
    expect(() =>
      withLogos({ data: [{ type: "scatter", x: ["2024-01-01"], y: [1] }], layout: {} }, ROWS, o),
    ).toThrow(/does not support date axes/);
    expect(() => withLogos({ data: [], layout: {} }, ROWS, { ...o, xref: "y" })).toThrow(
      /xref must name an x axis/,
    );
    expect(() => withLogos({ data: [], layout: {} }, ROWS, { ...o, height: 0 })).toThrow(InputError);
    expect(() => withLogos({ data: [], layout: {} }, ROWS, { ...o, alpha: 2 })).toThrow(InputError);
    expect(() => withLogos({ data: [], layout: {} }, ROWS, { ...o, x: "nope" })).toThrow(
      /x column "nope" is not in rows/,
    );
    expect(() => withLogos("not a figure" as unknown as PlotlyFigure, ROWS, o)).toThrow(
      UnsupportedTargetError,
    );
  });

  test("subplots: xref x2 / yref y2 size against xaxis2 / yaxis2 and their domains", () => {
    const out = withLogos(
      {
        data: [{ type: "scatter", x: [0, 1], y: [0, 1], xaxis: "x2", yaxis: "y2" }],
        layout: { xaxis2: { domain: [0.5, 1] }, yaxis2: { domain: [0, 0.5] } },
      },
      [{ x: 0.5, y: 0.5, team: KC }],
      { x: "x", y: "y", team: "team", league: "nfl", xref: "x2", yref: "y2" },
    );
    expect(out.layout!.images![0]).toMatchObject({ xref: "x2", yref: "y2" });
    expect(out.layout!.yaxis2!.autorange).toBe(false);
    expect(out.layout!.yaxis).toBeUndefined();
  });

  test("withWordmarks and withHeadshots draw their own kinds; embed swaps the source", () => {
    const wm = withWordmarks(scatter(), ROWS, { x: "x", y: "y", team: "team", league: "nfl" });
    expect(wm.layout!.images![0]!.name).toBe(`sdvplot:wordmark:${ID(KC)}`);
    const hs = withHeadshots(scatter(), [{ x: 10, y: -3, player: "3139477" }], {
      x: "x",
      y: "y",
      player: "player",
      league: "nfl",
      height: 0.2,
    });
    expect(hs.layout!.images![0]!.name).toBe("sdvplot:headshot:3139477");
    expect(drawnMarks(hs)[0]![3]).toBeCloseTo(0.2, 9);
    const url = drawnMarks(wm)[0]![4];
    const emb = withWordmarks(scatter(), ROWS, {
      x: "x",
      y: "y",
      team: "team",
      league: "nfl",
      embed: new Map([[url, "data:image/png;base64,QQ=="]]),
    });
    expect(drawnMarks(emb)[0]![4]).toBe("data:image/png;base64,QQ==");
  });
});

describe("figure pass-through", () => {
  test("every verb keeps config and frames", () => {
    const extra = { config: { responsive: true }, frames: [{ name: "a" }] };
    const bars: PlotlyFigure = { data: [{ type: "bar", x: ["KC", "BUF"], y: [1, 2] }], layout: {} };
    const outs = [
      withLogos({ ...scatter(), ...extra }, ROWS, { x: "x", y: "y", team: "team", league: "nfl" }),
      withWordmarks({ ...scatter(), ...extra }, ROWS, { x: "x", y: "y", team: "team", league: "nfl" }),
      withHeadshots({ ...scatter(), ...extra }, [{ x: 10, y: -3, player: "3139477" }], {
        x: "x",
        y: "y",
        player: "player",
        league: "nfl",
      }),
      withAxisLogos({ ...bars, ...extra }, "x", { league: "nfl" }),
    ];
    for (const o of outs) expect(o).toMatchObject(extra);
  });
});

describe("withAxisLogos", () => {
  const bars = (labels: string[]): PlotlyFigure => ({
    data: [{ type: "bar", x: labels, y: labels.map((_, i) => i + 1) }],
    layout: {},
  });

  test("x axis: resolved labels become images under the plot, unknown ones stay text with one warning, margin grows", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const out = withAxisLogos(
      { ...bars(["KC", "XXX", "BUF"]), layout: { height: 400, margin: { t: 50, b: 50 } } },
      "x",
      {
        league: "nfl",
        height: 0.1,
      },
    );
    setWarningHandler(null);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(drawnAxisMarks(out, "x")).toEqual([
      [ID(KC), 0, 0.1],
      [ID(BUF), 2, 0.1],
    ]);
    expect(visibleAxisLabels(out, "x")).toEqual(["XXX"]);
    expect(out.layout!.margin!.b).toBe(50 + Math.ceil((0.1 * 300) / 1.1));
    expect(out.layout!.images![0]).toMatchObject({
      yref: "y domain",
      y: 0,
      sizey: 0.1,
      yanchor: "top",
      xref: "x",
      xanchor: "center",
      sizex: 6,
    });
    expect(out.layout!.xaxis).toMatchObject({ tickmode: "array", tickvals: ["XXX"], ticktext: ["XXX"] });
  });

  test("y axis: images left of the plot, range pinned to the category bands, sizey = h × span", () => {
    const out = withAxisLogos(
      { data: [{ type: "bar", y: ["KC", "BUF"], x: [1, 2], orientation: "h" }], layout: {} },
      "y",
      { league: "nfl", height: 0.1 },
    );
    expect(drawnAxisMarks(out, "y")).toEqual([
      [ID(KC), 0, 0.1],
      [ID(BUF), 1, 0.1],
    ]);
    expect(visibleAxisLabels(out, "y")).toEqual([]);
    expect(out.layout!.yaxis!.range).toEqual([-0.5, 1.5]);
    expect(out.layout!.images![0]!.sizey).toBeCloseTo(0.2, 9); // 0.1 of the two-category span
    expect(out.layout!.images![0]).toMatchObject({
      xref: "paper",
      x: 0,
      xanchor: "right",
      yanchor: "middle",
      sizex: 1,
    });
    expect(out.layout!.margin!.l).toBeGreaterThan(80);
  });

  test("subplot: bar on xaxis2 hangs its images under that subplot, in its y domain; error names the checked axis", () => {
    const fig: PlotlyFigure = {
      data: [{ type: "bar", x: ["KC", "BUF"], y: [1, 2], xaxis: "x2", yaxis: "y2" }],
      layout: { xaxis2: { domain: [0.5, 1] }, yaxis2: { domain: [0.2, 0.9] } },
    };
    const out = withAxisLogos(fig, "x", { league: "nfl", xref: "x2", yref: "y2" });
    expect(out.layout!.images![0]).toMatchObject({ xref: "x2", yref: "y2 domain", y: 0, sizey: 0.1 });
    expect(out.layout!.margin).toBeUndefined(); // 0.1 of 0.7 hangs above the paper's bottom: nothing to make room for
    expect(out.layout!.xaxis2).toMatchObject({
      tickmode: "array",
      ticktext: ["KC", "BUF"],
      showticklabels: false,
    });
    expect(() => withAxisLogos(fig, "x", { league: "nfl" })).toThrow(/x axis \(x\)/);
  });

  test("stacked subplots: x-axis images on the lower one are `height` of THAT subplot and fit the grown margin", () => {
    const fig: PlotlyFigure = {
      data: [
        { type: "scatter", x: [0, 1], y: [0, 1] },
        { type: "bar", x: ["KC", "BUF"], y: [1, 2], xaxis: "x2", yaxis: "y2" },
      ],
      layout: { yaxis: { domain: [0.55, 1] }, yaxis2: { domain: [0, 0.45] } },
    };
    const out = withAxisLogos(fig, "x", { league: "nfl", xref: "x2", yref: "y2", height: 0.1 });
    expect(out.layout!.images![0]).toMatchObject({ yref: "y2 domain", y: 0, sizey: 0.1, yanchor: "top" });
    const paper = 450 - 100 - 80; // plotly's default height less its default margins
    const grown = out.layout!.margin!.b! - 80;
    expect(grown).toBe(Math.ceil((0.1 * 0.45 * paper) / (1 + 0.1 * 0.45))); // 12 px
    const logoPx = 0.1 * 0.45 * (paper - grown); // the subplot shrinks with the paper
    expect(logoPx).toBeLessThanOrEqual(grown);
    expect(grown - logoPx).toBeLessThan(1);
    expect(drawnAxisMarks(out, "x").map((m) => m[2])).toEqual([0.1, 0.1]);
  });

  test("subplot y axis: bar on yaxis2 gets yref y2 and paper x at the xref axis's domain left", () => {
    const fig: PlotlyFigure = {
      data: [{ type: "bar", y: ["KC", "BUF"], x: [1, 2], orientation: "h", xaxis: "x2", yaxis: "y2" }],
      layout: { xaxis2: { domain: [0.3, 1] }, yaxis2: { domain: [0.1, 0.8] } },
    };
    const out = withAxisLogos(fig, "y", { league: "nfl", xref: "x2", yref: "y2" });
    expect(out.layout!.images).toHaveLength(2);
    expect(out.layout!.images![0]).toMatchObject({ xref: "paper", x: 0.3, yref: "y2", xanchor: "right" });
    expect(out.layout!.yaxis2).toMatchObject({
      tickmode: "array",
      ticktext: ["KC", "BUF"],
      showticklabels: false,
      range: [-0.5, 1.5],
    });
    expect(drawnAxisMarks(out, "y")).toEqual([
      [ID(KC), 0, 0.1],
      [ID(BUF), 1, 0.1],
    ]);
  });

  test("needs a category axis; axis must be x or y; wordmarks via markType", () => {
    expect(() =>
      withAxisLogos({ data: [{ type: "scatter", x: [1, 2], y: [1, 2] }], layout: {} }, "x", {
        league: "nfl",
      }),
    ).toThrow(/needs a category x axis/);
    expect(() => withAxisLogos(bars(["KC"]), "z" as "x", { league: "nfl" })).toThrow(InputError);
    const out = withAxisLogos(bars(["KC"]), "x", { league: "nfl", markType: "wordmark" });
    expect(out.layout!.images![0]!.name).toBe(`sdvplot:axis:x:${ID(KC)}`);
  });

  // plotly.js (4.1.2, Axes.tickText) builds a category's hover label the way it builds its tick label: an array-mode tick
  // reads its ticktext entry, so a blank entry blanks the hover too ("(, 15)"). Any other category's hover is its name,
  // and it has no tick label when the tick values are an array that leaves it out. [hover, tick label drawn ("" = none)]
  const plotlyShows = (ax: PlotlyAxis, c: string): [string, string] => {
    const i = ax.tickmode === "array" ? (ax.tickvals ?? []).indexOf(c) : -1;
    const text = i >= 0 && i < (ax.ticktext ?? []).length ? ax.ticktext![i]! : c;
    return [text, (ax.tickmode !== "array" || i >= 0) && ax.showticklabels !== false ? text : ""];
  };
  // the docs' chart: 2024 AFC wins, best first
  const teams = [...STANDINGS].sort((a, b) => b.wins - a.wins).map((s) => s.team);
  const wins = (t: string) => STANDINGS.find((s) => s.team === t)?.wins ?? 0;

  test("x axis: hover names every team (2024 AFC wins) while the tick labels stay blank; every tick is kept", () => {
    const fig: PlotlyFigure = {
      data: [{ type: "bar", x: teams, y: teams.map(wins) }],
      layout: { width: 560, height: 360 },
    };
    const out = withAxisLogos(fig, "x", { league: "nfl", height: 0.1 });
    expect(drawnAxisMarks(out, "x").map((m) => m[0])).toEqual(teams.map(ID));
    expect(teams.map((t) => plotlyShows(out.layout!.xaxis!, t))).toEqual(teams.map((t) => [t, ""]));
    expect(out.layout!.xaxis!.tickvals).toEqual(teams); // a tick (grid line, tick mark) per category, as before
    expect(visibleAxisLabels(out, "x")).toEqual([]);
  });

  test("y axis: hover names every team (2024 AFC wins) while the tick labels stay blank", () => {
    const fig: PlotlyFigure = {
      data: [{ type: "bar", orientation: "h", y: teams, x: teams.map(wins) }],
      layout: { width: 560, height: 360 },
    };
    const out = withAxisLogos(fig, "y", { league: "nfl", height: 0.1 });
    expect(drawnAxisMarks(out, "y")).toHaveLength(teams.length);
    expect(teams.map((t) => plotlyShows(out.layout!.yaxis!, t))).toEqual(teams.map((t) => [t, ""]));
    expect(visibleAxisLabels(out, "y")).toEqual([]);
  });

  test("an unknown category keeps its label; hover still names every team", () => {
    const cats = [teams[0]!, "XXX", teams[1]!, teams[2]!];
    setWarningHandler(() => {});
    const out = withAxisLogos({ data: [{ type: "bar", x: cats, y: cats.map(wins) }], layout: {} }, "x", {
      league: "nfl",
    });
    setWarningHandler(null);
    expect(cats.map((c) => plotlyShows(out.layout!.xaxis!, c))).toEqual(
      cats.map((c) => [c, c === "XXX" ? c : ""]),
    );
    expect(visibleAxisLabels(out, "x")).toEqual(["XXX"]);
  });

  test("teamColorway: one colour per team, fallback for unknown", () => {
    const cw = teamColorway("nfl", [KC, "XXX", BUF], { fallback: "#999999" });
    expect(cw).toHaveLength(3);
    expect(cw[0]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(cw[1]).toBe("#999999");
    expect(teamColorway("nfl", [KC], { which: "secondary" })[0]).not.toBe(cw[0]);
  });
});
