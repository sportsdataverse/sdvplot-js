import * as echarts from "echarts";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { STANDINGS } from "../../sdvtables/test/fixtures/standings.js";
import {
  type EChartsAxis,
  type EChartsOption,
  type LogoSeries,
  drawnAxisMarks,
  drawnMarks,
  renderLogo,
  teamColorPalette,
  visibleAxisLabels,
  withAxisLogos,
  withHeadshots,
  withLogos,
  withWordmarks,
} from "../src/echarts.js";
import { InputError, UnsupportedTargetError } from "../src/errors.js";
import { resetWarnings, resolveSync, setWarningHandler } from "../src/index.js";
import { BUF, KC, ROWS, ROWS_UNKNOWN } from "./_fixtures.js";

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own

const ID = (t: string) => resolveSync(t, "nfl") as string;
const scatter = (): EChartsOption => ({
  xAxis: { type: "value" },
  yAxis: { type: "value" },
  series: [
    {
      type: "scatter",
      data: [
        [10, -3],
        [20, -7],
      ],
    },
  ],
});

/** Render an option headlessly (SSR SVG) and read back the <image> elements as { href, width, height, x, y }. */
function renderImages(
  option: object,
  width = 600,
  height = 400,
): { href: string; width: number; height: number; x: number; y: number }[] {
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
  chart.setOption({ ...option, animation: false } as echarts.EChartsOption);
  const svg = chart.renderToSVGString();
  chart.dispose();
  return [...svg.matchAll(/<image ([^>]*)\/?>/g)].map((m) => {
    const attr = (n: string) => m[1]!.match(new RegExp(`${n}="([^"]*)"`))?.[1] ?? "";
    return {
      href: attr("href") || attr("xlink:href"),
      width: Number(attr("width")),
      height: Number(attr("height")),
      x: Number(attr("x")),
      y: Number(attr("y")),
    };
  });
}

describe("withLogos", () => {
  test("appends one custom series whose data carries [x, y, url, teamId, aspect, height, alpha]; returns a NEW option", () => {
    const opt = scatter();
    const before = structuredClone(opt);
    const out = withLogos(opt, ROWS, { x: "x", y: "y", team: "team", league: "nfl", height: 0.1 });
    expect(opt).toEqual(before); // Review Focus 5
    expect(out.series).toHaveLength(2);
    const s = out.series![1] as LogoSeries;
    expect(s).toMatchObject({
      id: "sdvplot:logo",
      type: "custom",
      coordinateSystem: "cartesian2d",
      encode: { x: 0, y: 1 },
      silent: true,
    });
    expect(s.data[0]!.slice(0, 2)).toEqual([10, -3]);
    expect(s.data[0]![3]).toBe(ID(KC));
    expect(s.data[0]![5]).toBe(0.1);
    expect(drawnMarks(out).map(([id, x, y, h]) => [id, x, y, h])).toEqual([
      [ID(KC), 10, -3, 0.1],
      [ID(BUF), 20, -7, 0.1],
    ]);
  });

  test("rendered headlessly: each logo is height × grid height pixels tall and centred on its point", () => {
    const out = withLogos({ ...scatter(), grid: { left: 50, right: 50, top: 40, bottom: 40 } }, ROWS, {
      x: "x",
      y: "y",
      team: "team",
      league: "nfl",
      height: 0.25,
    });
    const imgs = renderImages(out, 600, 400);
    expect(imgs).toHaveLength(2);
    expect(imgs[0]!.height).toBeCloseTo(0.25 * (400 - 80), 6); // grid height = 320
    expect(imgs[0]!.href).toBe(drawnMarks(out)[0]![4]);
    // centred: the image's centre is inside the grid, and both images sit at distinct x
    expect(imgs[0]!.x + imgs[0]!.width / 2).toBeGreaterThan(50);
    expect(imgs[1]!.x).not.toBe(imgs[0]!.x);
  });

  test("category x axis: logos land on the category index when rendered", () => {
    // Review Focus 4
    const out = withLogos(
      {
        xAxis: { type: "category", data: ["KC", "BUF", "BAL"] },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: [12, 10, 9] }],
      },
      [
        { x: "KC", y: 12, team: KC },
        { x: "BAL", y: 9, team: "BAL" },
      ],
      { x: "x", y: "y", team: "team", league: "nfl" },
    );
    const imgs = renderImages(out);
    expect(imgs).toHaveLength(2);
    for (const i of imgs) {
      expect(Number.isNaN(i.x)).toBe(false);
      expect(Number.isNaN(i.y)).toBe(false);
    }
    expect(imgs[1]!.x).toBeGreaterThan(imgs[0]!.x); // "BAL" is right of "KC"
  });

  test("renderItem returns an image element in data coordinates via api.coord and sizes from coordSys.height", () => {
    const s = withLogos(scatter(), [ROWS[0]], {
      x: "x",
      y: "y",
      team: "team",
      league: "nfl",
      height: 0.1,
      alpha: 0.5,
    }).series![1] as LogoSeries;
    const el = s.renderItem(
      { coordSys: { x: 0, y: 0, width: 500, height: 200 } },
      { value: (i) => s.data[0]![i]!, coord: () => [100, 50] },
    );
    expect(el.type).toBe("image");
    expect(el.style.height).toBe(20);
    expect(el.style.width).toBeCloseTo(20 * (s.data[0]![4] as number), 9);
    expect(el.style.x).toBeCloseTo(100 - el.style.width / 2, 9);
    expect(el.style.y).toBe(40);
    expect(el.style.opacity).toBe(0.5);
    expect(el.style.image).toBe(s.data[0]![2]);
  });

  test("a second call on other axes gets its own series and draws inside its own grid (echarts SSR)", () => {
    const value = (gridIndex: number, min: number, max: number) => ({ type: "value", gridIndex, min, max });
    const twoGrids = {
      grid: [
        { top: 20, height: 150 },
        { top: 220, height: 150 },
      ],
      xAxis: [value(0, 0, 30), value(1, 0, 30)],
      yAxis: [value(0, -10, 0), value(1, -10, 0)],
      series: [
        { type: "scatter", data: [[10, -3]] },
        { type: "scatter", xAxisIndex: 1, yAxisIndex: 1, data: [[20, -7]] },
      ],
    };
    const o = { x: "x", y: "y", team: "team", league: "nfl" } as const;
    const out = withLogos(withLogos(twoGrids, [ROWS[0]], o), [ROWS[1]], {
      ...o,
      xAxisIndex: 1,
      yAxisIndex: 1,
    });
    expect(out.series.map((s) => (s as { id?: string }).id)).toEqual([
      undefined,
      undefined,
      "sdvplot:logo",
      "sdvplot:logo:1:1:100",
    ]);
    const centres = renderImages(out).map((i) => i.y + i.height / 2);
    expect(centres).toHaveLength(2);
    expect(centres[0]).toBeCloseTo(20 + 0.3 * 150, 0); // y = -3 in grid 0
    expect(centres[1]).toBeCloseTo(220 + 0.7 * 150, 0); // y = -7 in grid 1, not in grid 0
    // a repeat call on the same axes and z joins that series; another z gets its own
    expect(withLogos(out, [ROWS[0]], { ...o, xAxisIndex: 1, yAxisIndex: 1 }).series).toHaveLength(4);
    expect(withLogos(out, [ROWS[0]], { ...o, z: 5 }).series.at(-1)).toMatchObject({
      id: "sdvplot:logo:0:0:5",
      z: 5,
    });
  });

  test("drawnMarks reads what the series' renderItem draws", () => {
    const out = withLogos(scatter(), ROWS, { x: "x", y: "y", team: "team", league: "nfl", height: 0.1 });
    const s = out.series![1] as LogoSeries;
    s.renderItem = (p, api) => {
      const el = renderLogo(p, api);
      return { ...el, style: { ...el.style, height: 10 } }; // a fixed 10 px, whatever the grid
    };
    expect(drawnMarks(out).map((m) => m[3])).toEqual([0.01, 0.01]); // 10 px of the hooks' 1000 px grid
  });

  test("unknown team: one warning, skipped; empty rows add no series", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const out = withLogos(scatter(), ROWS_UNKNOWN, { x: "x", y: "y", team: "team", league: "nfl" });
    setWarningHandler(null);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(drawnMarks(out).map((m) => m[0])).toEqual([ID(KC)]);
    expect(withLogos(scatter(), [], { x: "x", y: "y", team: "team", league: "nfl" }).series).toHaveLength(1);
  });

  test("validation: height, alpha, columns, target; wordmarks, headshots, embed, axis indices", () => {
    const o = { x: "x", y: "y", team: "team", league: "nfl" } as const;
    expect(() => withLogos(scatter(), ROWS, { ...o, height: 1.5 })).toThrow(InputError);
    expect(() => withLogos(scatter(), ROWS, { ...o, alpha: -1 })).toThrow(InputError);
    expect(() => withLogos(scatter(), ROWS, { ...o, team: "nope" })).toThrow(
      /team column "nope" is not in rows/,
    );
    expect(() => withLogos([] as unknown as EChartsOption, ROWS, o)).toThrow(UnsupportedTargetError);
    expect((withWordmarks(scatter(), ROWS, o).series![1] as LogoSeries).id).toBe("sdvplot:wordmark");
    const hs = withHeadshots(scatter(), [{ x: 10, y: -3, player: "3139477" }], {
      x: "x",
      y: "y",
      player: "player",
      league: "nfl",
      height: 0.2,
    });
    expect(drawnMarks(hs)[0]!.slice(0, 4)).toEqual(["3139477", 10, -3, 0.2]);
    const url = drawnMarks(hs)[0]![4];
    expect(
      drawnMarks(
        withHeadshots(scatter(), [{ x: 10, y: -3, player: "3139477" }], {
          x: "x",
          y: "y",
          player: "player",
          league: "nfl",
          embed: new Map([[url, "data:image/png;base64,QQ=="]]),
        }),
      )[0]![4],
    ).toBe("data:image/png;base64,QQ==");
    expect(withLogos(scatter(), ROWS, { ...o, xAxisIndex: 1, yAxisIndex: 1, z: 5 }).series![1]).toMatchObject(
      {
        xAxisIndex: 1,
        yAxisIndex: 1,
        z: 5,
      },
    );
  });
});

describe("withAxisLogos", () => {
  const bars = (labels: string[]): EChartsOption => ({
    xAxis: { type: "category", data: labels },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: labels.map((_, i) => i + 1) }],
  });

  test("x axis: resolved labels become rich image labels, unknown stay text with one warning", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const out = withAxisLogos(bars(["KC", "XXX", "BUF"]), "x", {
      league: "nfl",
      height: 0.1,
      chartHeight: 400,
    });
    setWarningHandler(null);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(drawnAxisMarks(out, "x")).toEqual([
      [ID(KC), 0, 0.1],
      [ID(BUF), 2, 0.1],
    ]);
    expect(visibleAxisLabels(out, "x")).toEqual(["XXX"]);
    const label = (
      out.xAxis as {
        axisLabel: {
          formatter: (v: string) => string;
          rich: Record<string, { height: number; backgroundColor: { image: string } }>;
        };
      }
    ).axisLabel;
    expect(label.formatter("KC")).toBe("{t_0|}");
    expect(label.formatter("XXX")).toBe("XXX");
    expect(label.rich.t_0!.height).toBe(25.5); // 0.1 of the default grid: 400 - 65 - 80 px
    expect(label.rich.t_0!.backgroundColor.image).toMatch(/^https:/);
    const imgs = renderImages(out, 600, 400);
    expect(imgs.length).toBeGreaterThanOrEqual(2); // the rich backgrounds render as <image>
    expect(imgs.some((i) => Math.abs(i.height - 25.5) < 1)).toBe(true);
  });

  test("axis images are `height` of the grid (the plot area), as the mark images are (echarts SSR)", () => {
    const base: EChartsOption = {
      xAxis: { type: "category", data: ["KC", "BUF"] },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: [3, 5] }],
    };
    const marks = withLogos(base, [{ x: "KC", y: 3, team: KC }], {
      x: "x",
      y: "y",
      team: "team",
      league: "nfl",
      height: 0.1,
    });
    const heights = renderImages(withAxisLogos(marks, "x", { league: "nfl", height: 0.1 })).map(
      (i) => i.height,
    );
    expect(heights).toHaveLength(3); // one mark logo, two axis logos
    for (const h of heights) expect(h).toBeCloseTo(0.1 * (400 - 65 - 80), 1);
    const sized: [Record<string, unknown>, number][] = [
      [{ top: 40, bottom: 40 }, 32],
      [{ height: "50%" }, 20],
    ];
    for (const [grid, px] of sized) {
      const imgs = renderImages(withAxisLogos({ ...base, grid }, "x", { league: "nfl", height: 0.1 }));
      expect(imgs.map((i) => i.height)).toEqual([px, px]);
    }
    expect(() => withAxisLogos(base, "x", { league: "nfl", chartHeight: 100 })).toThrow(
      /pass the canvas height/,
    );
  });

  test("the axis test hooks read the option: what the formatter shows, the rich image height", () => {
    const out = withAxisLogos(bars(["KC", "XXX", "BUF"]), "x", { league: "nfl", height: 0.1 });
    const label = (
      out.xAxis as {
        axisLabel: { formatter: (v: string) => string; rich: Record<string, { height: number }> };
      }
    ).axisLabel;
    expect(visibleAxisLabels(out, "x")).toEqual(["XXX"]);
    expect(drawnAxisMarks(out, "x")[0]![2]).toBeCloseTo(0.1, 9);
    label.formatter = (v) => `{t_0|}${v}`; // an image AND the text
    expect(visibleAxisLabels(out, "x")).toEqual(["KC", "XXX", "BUF"]);
    label.rich.t_0!.height *= 1.5;
    expect(drawnAxisMarks(out, "x")[0]![2]).toBeCloseTo(0.15, 9);
  });

  test("y axis on a horizontal bar chart; an existing string formatter is kept for unresolved labels", () => {
    const opt: EChartsOption = {
      yAxis: { type: "category", data: ["KC", "XXX"], axisLabel: { formatter: "[{value}]" } },
      xAxis: { type: "value" },
      series: [{ type: "bar", data: [1, 2] }],
    };
    const out = withAxisLogos(opt, "y", { league: "nfl", height: 0.1, chartHeight: 300 });
    const label = (out.yAxis as { axisLabel: { formatter: (v: string) => string } }).axisLabel;
    expect(label.formatter("XXX")).toBe("[XXX]");
    expect(label.formatter("KC")).toBe("{t_0|}");
    expect(drawnAxisMarks(out, "y")).toEqual([[ID(KC), 0, 0.1]]);
    // a function formatter still gets ECharts' own (value, index) arguments for an unresolved label
    const fn = withAxisLogos(
      {
        ...opt,
        yAxis: {
          type: "category",
          data: ["KC", "XXX"],
          axisLabel: { formatter: (v: string, i: number) => `${i}:${v}` },
        },
      },
      "y",
      { league: "nfl" },
    );
    expect(
      (fn.yAxis as { axisLabel: { formatter: (v: string, i: number) => string } }).axisLabel.formatter(
        "XXX",
        1,
      ),
    ).toBe("1:XXX");
  });

  test("needs a category axis with data; axis must be x or y; default chartHeight is 400", () => {
    expect(() => withAxisLogos(scatter(), "x", { league: "nfl" })).toThrow(
      /needs a category x axis with data/,
    );
    expect(() => withAxisLogos(bars(["KC"]), "q" as "x", { league: "nfl" })).toThrow(InputError);
    expect(
      (
        withAxisLogos(bars(["KC"]), "x", { league: "nfl", height: 0.1 }).xAxis as {
          axisLabel: { rich: Record<string, { height: number }> };
        }
      ).axisLabel.rich.t_0!.height,
    ).toBe(25.5);
  });

  test("the axis bookkeeping leaves the value axis alone (horizontal and vertical bars on a scale: true axis)", () => {
    const bars = (option: EChartsOption): string[] => {
      const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 600, height: 400 });
      chart.setOption({ ...option, animation: false } as echarts.EChartsOption);
      const svg = chart.renderToSVGString();
      chart.dispose();
      return [...svg.matchAll(/<path d="([^"]*)"[^>]*ecmeta_series_index="0"/g)].map((m) => m[1]!);
    };
    const value = { type: "value", scale: true } as EChartsAxis; // an axis whose extent does NOT include 0
    const cases: ["x" | "y", EChartsOption][] = [
      [
        "x",
        {
          xAxis: { type: "category", data: ["KC", "BUF"] },
          yAxis: value,
          series: [{ type: "bar", data: [7, 9] }],
        },
      ],
      [
        "y",
        {
          yAxis: { type: "category", data: ["KC", "BUF"] },
          xAxis: value,
          series: [{ type: "bar", data: [7, 9] }],
        },
      ],
    ];
    for (const [letter, option] of cases) {
      expect(bars(option)).toHaveLength(2);
      expect(bars(withAxisLogos(option, letter, { league: "nfl" }))).toEqual(bars(option));
    }
  });

  test("teamColorPalette: one colour per team for option.color", () => {
    const c = teamColorPalette("nfl", [KC, "XXX", BUF], { fallback: "#999999" });
    expect(c).toHaveLength(3);
    expect(c[0]).toMatch(/^#/);
    expect(c[1]).toBe("#999999");
  });
});

describe("helper series", () => {
  test("never reach a default legend: the rendered legend lists the caller's series only", () => {
    const base: EChartsOption & { legend: Record<string, never> } = {
      legend: {},
      xAxis: { type: "category", data: ["KC", "BUF"] },
      yAxis: { type: "value" },
      series: [{ type: "bar", name: "Wins", data: [12, 11] }],
    };
    const o = { x: "x", y: "y", team: "team", league: "nfl" } as const;
    const rows = [
      { x: "KC", y: 12, team: KC },
      { x: "BUF", y: 11, team: BUF },
    ];
    const out = withAxisLogos(withLogos(base, rows, o), "x", { league: "nfl" });
    expect(out.series).toHaveLength(3);
    const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 600, height: 400 });
    chart.setOption({ ...out, animation: false } as echarts.EChartsOption);
    const svg = chart.renderToSVGString();
    chart.dispose();
    expect(svg).toContain(">Wins<"); // the legend renders
    expect(svg).not.toContain("sdvplot");
  });

  test("never reach an axis-trigger tooltip; the caller's series and tooltip are untouched", () => {
    // echarts 6.1.0 lib/component/axisPointer/modelHelper.js collectSeriesInfo: a series joins the axis tooltip unless
    // its OWN tooltip.show is false, tooltip.trigger is "none"/"item"/false, or axisPointer.show is false. `silent` is
    // not read there, so the helpers each showed a stray row ("-" for the axis bookkeeping, the value for a mark).
    const joinsAxisTooltip = (s: Record<string, unknown>): boolean => {
      const t = (s.tooltip ?? {}) as { show?: unknown; trigger?: unknown };
      const pointer = (s.axisPointer ?? {}) as { show?: unknown };
      return (
        t.show !== false && !["none", "item", false].includes(t.trigger as never) && pointer.show !== false
      );
    };
    const afc = [...STANDINGS].sort((a, b) => b.wins - a.wins);
    const base: EChartsOption & { tooltip: { trigger: "axis" } } = {
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: afc.map((s) => s.team) },
      yAxis: { type: "value" },
      series: [{ type: "bar", name: "wins", data: afc.map((s) => s.wins) }],
    };
    const rows = afc.map((s) => ({ x: s.team, y: s.wins, team: s.team, player: s.qb_espn_id }));
    const o = { x: "x", y: "y", team: "team", league: "nfl" } as const;
    let out = withAxisLogos(base, "x", { league: "nfl" });
    out = withLogos(out, rows, o);
    out = withWordmarks(out, rows, { ...o, z: 101 });
    out = withHeadshots(out, rows, { x: "x", y: "y", player: "player", league: "nfl", z: 102 });
    const [user, ...helpers] = out.series! as Record<string, unknown>[];
    expect(helpers.map((s) => s.id)).toEqual([
      "sdvplot:axis:x",
      "sdvplot:logo",
      "sdvplot:wordmark:0:0:101",
      "sdvplot:headshot:0:0:102",
    ]);
    for (const s of helpers) expect(s.tooltip).toEqual({ show: false });
    expect(out.series!.filter((s) => joinsAxisTooltip(s as Record<string, unknown>))).toEqual([user]);
    expect(user).toEqual(base.series![0]);
    expect((out as typeof base).tooltip).toEqual({ trigger: "axis" });
  });

  test("visibleAxisLabels reads the axis withAxisLogos drew on (axisIndex)", () => {
    const option: EChartsOption = {
      xAxis: [
        { type: "category", data: ["Q1", "Q2", "Q3"] },
        { type: "category", data: ["KC", "XXX", "BUF"] },
      ],
      yAxis: { type: "value" },
      series: [{ type: "bar", data: [1, 2, 3] }],
    };
    const out = withAxisLogos(option, "x", { league: "nfl", axisIndex: 1 });
    expect(out.series!.at(-1)).toMatchObject({ id: "sdvplot:axis:x", xAxisIndex: 1 });
    expect(visibleAxisLabels(out, "x")).toEqual(["XXX"]);
    expect(visibleAxisLabels(withAxisLogos(option, "x", { league: "nfl" }), "x")).toEqual(["Q1", "Q2", "Q3"]);
  });
});
