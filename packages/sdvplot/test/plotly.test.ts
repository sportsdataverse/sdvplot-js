import { beforeEach, describe, expect, test, vi } from "vitest";
import { InputError, UnsupportedTargetError } from "../src/errors.js";
import { resetWarnings, resolveSync, setWarningHandler } from "../src/index.js";
import { type PlotlyFigure, drawnMarks, withHeadshots, withLogos, withWordmarks } from "../src/plotly.js";
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
