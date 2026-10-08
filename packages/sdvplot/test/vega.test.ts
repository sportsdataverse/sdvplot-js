import { compile } from "vega-lite";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InputError, UnsupportedTargetError } from "../src/errors.js";
import { resetWarnings, resolveSync, setWarningHandler } from "../src/index.js";
import {
  type VegaLiteSpec,
  drawnAxisMarks,
  drawnMarks,
  logoLayer,
  teamColorScale,
  visibleAxisLabels,
  withAxisLogos,
  withHeadshots,
  withLogos,
  withWordmarks,
} from "../src/vega.js";
import { BUF, KC, ROWS, ROWS_UNKNOWN } from "./_fixtures.js";

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own

const ID = (t: string) => resolveSync(t, "nfl") as string;
const points = (): VegaLiteSpec => ({
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  data: {
    values: [
      { epa: 10, sr: -3 },
      { epa: 20, sr: -7 },
    ],
  },
  mark: "point",
  encoding: {
    x: { field: "epa", type: "quantitative", title: "EPA" },
    y: { field: "sr", type: "quantitative" },
  },
});

describe("withLogos", () => {
  test("wraps a unit spec into a layer spec and draws h × chart height pixel images using the chart's field names", () => {
    const spec = points();
    const before = structuredClone(spec);
    const out = withLogos(spec, ROWS, { x: "x", y: "y", team: "team", league: "nfl", height: 0.12 });
    expect(spec).toEqual(before); // Review Focus 5
    expect(out.layer).toHaveLength(2);
    expect((out.layer![0] as VegaLiteSpec).mark).toBe("point");
    const layer = out.layer![1] as {
      name: string;
      mark: { type: string; height: number; width: number; aspect: boolean };
      encoding: Record<string, { field?: string; type?: string }>;
      data: { values: Record<string, unknown>[] };
    };
    expect(layer.name).toBe("sdvplot_logo");
    expect(layer.mark).toMatchObject({ type: "image", height: 36, aspect: true }); // 0.12 × 300 (Vega-Lite's default continuous height)
    expect(layer.mark.width).toBeGreaterThanOrEqual(36);
    expect(layer.encoding.x).toMatchObject({ field: "epa", type: "quantitative" });
    expect(layer.encoding.x).not.toHaveProperty("title"); // the chart's title wins; the layer adds none
    expect(layer.encoding.url).toEqual({ field: "sdvplot_url", type: "nominal" });
    expect(layer.data.values[0]).toMatchObject({ epa: 10, sr: -3, sdvplot_team: ID(KC) });
    expect(drawnMarks(out).map(([id, x, y, h]) => [id, x, y, h])).toEqual([
      [ID(KC), 10, -3, 0.12],
      [ID(BUF), 20, -7, 0.12],
    ]);
  });

  test("the chart's own height and config.view.continuousHeight size the images", () => {
    expect(
      drawnMarks(
        withLogos({ ...points(), height: 500 }, ROWS, {
          x: "x",
          y: "y",
          team: "team",
          league: "nfl",
          height: 0.1,
        }),
      )[0]![3],
    ).toBeCloseTo(0.1, 9);
    const out = withLogos({ ...points(), config: { view: { continuousHeight: 200 } } }, ROWS, {
      x: "x",
      y: "y",
      team: "team",
      league: "nfl",
      height: 0.1,
    });
    expect((out.layer![1] as { mark: { height: number } }).mark.height).toBe(20);
  });

  test("an existing layer spec gains one layer and keeps width, height and title", () => {
    // Review Focus 3
    const layered: VegaLiteSpec = {
      title: "T",
      width: 400,
      height: 250,
      data: points().data,
      layer: [
        { mark: "point", encoding: points().encoding },
        { mark: "rule", encoding: { y: { datum: 0 } } },
      ],
    };
    const out = withLogos(layered, ROWS, { x: "x", y: "y", team: "team", league: "nfl" });
    expect(out.layer).toHaveLength(3);
    expect(out).toMatchObject({ title: "T", width: 400, height: 250 });
    expect((out.layer![2] as { mark: { height: number } }).mark.height).toBe(25);
  });

  test("a sort Vega-Lite would drop raises InputError naming the fix", () => {
    const bars: VegaLiteSpec = {
      data: { values: [{ team: "KC", w: 12 }] },
      mark: "bar",
      encoding: {
        x: { field: "team", type: "nominal", sort: { field: "w", op: "mean" } },
        y: { field: "w", type: "quantitative" },
      },
    };
    expect(() =>
      withLogos(bars, [{ x: "KC", y: 12, team: KC }], {
        x: "x",
        y: "y",
        team: "team",
        league: "nfl",
        height: 0.1,
      }),
    ).toThrow(
      /drops the x sort \{"field":"w","op":"mean"\} once a layer is added; sort with an explicit list/,
    );
    // the shorthand "-y" on a summed y compiles to op "sum", which Vega-Lite drops as well
    const summed = {
      ...bars,
      encoding: {
        x: { field: "team", type: "nominal", sort: "-y" },
        y: { field: "w", aggregate: "sum", type: "quantitative" },
      },
    };
    expect(() => withAxisLogos({ ...summed, height: 100 }, "x", { league: "nfl" })).toThrow(
      /drops the x sort "-y"/,
    );
    const kept = withLogos(
      { ...bars, encoding: { ...bars.encoding, x: { field: "team", type: "nominal", sort: ["KC"] } } },
      [{ x: "KC", y: 12, team: KC }],
      { x: "x", y: "y", team: "team", league: "nfl" },
    );
    expect((kept.layer![1] as { encoding: { x: { sort: unknown } } }).encoding.x.sort).toEqual(["KC"]);
  });

  test('the channel sort shorthand ("-y", "x") is read as the field sort Vega-Lite compiles it to', () => {
    const sortOfLayer = (s: VegaLiteSpec, ch: "x" | "y") =>
      (s.layer!.at(-1) as { encoding: Record<string, { sort?: unknown }> }).encoding[ch]!.sort;
    const warningsOf = (s: VegaLiteSpec): unknown[] => {
      const warnings: unknown[] = [];
      const logger = {
        level: () => 0,
        error(...a: unknown[]) {
          warnings.push(a);
          return this;
        },
        warn(...a: unknown[]) {
          warnings.push(a);
          return this;
        },
        info() {
          return this;
        },
        debug() {
          return this;
        },
      };
      compile(s as Parameters<typeof compile>[0], { logger });
      return warnings;
    };
    const dots: VegaLiteSpec = {
      height: 100,
      data: { values: [{ team: "KC", w: 12 }] },
      mark: "point",
      encoding: {
        x: { field: "team", type: "nominal", sort: "-y" },
        y: { field: "w", type: "quantitative" },
      },
    };
    const out = withLogos(dots, [{ x: "KC", y: 12, team: KC }], {
      x: "x",
      y: "y",
      team: "team",
      league: "nfl",
    });
    expect(sortOfLayer(out, "x")).toEqual({ field: "w", op: "min", order: "descending" });
    expect(warningsOf(out)).toEqual([]); // both layers sort the shared x scale the same way: nothing dropped
    const counted = {
      ...dots,
      mark: "bar",
      encoding: { ...dots.encoding, y: { aggregate: "count", type: "quantitative" } },
    };
    const axis = withAxisLogos(counted, "x", { league: "nfl" });
    expect(sortOfLayer(axis, "x")).toEqual({ op: "count", order: "descending" });
    expect(warningsOf(axis)).toEqual([]);
    const ticks: VegaLiteSpec = {
      ...dots,
      mark: "tick",
      encoding: { y: { field: "team", type: "nominal", sort: "x" }, x: { field: "w", type: "quantitative" } },
    };
    expect(sortOfLayer(withAxisLogos(ticks, "y", { league: "nfl" }), "y")).toEqual({ field: "w", op: "min" });
    // a bar stacks its measure, so "-y" sums it: Vega-Lite drops that sort too (measured: "Dropping sort property")
    expect(() => withAxisLogos({ ...dots, mark: "bar" }, "x", { league: "nfl" })).toThrow(
      'drops the x sort "-y" ({"field":"w","op":"sum","order":"descending"}) once a layer is added',
    );
    const unstacked = {
      ...dots,
      mark: "bar",
      encoding: { ...dots.encoding, y: { field: "w", type: "quantitative", stack: null } },
    };
    expect(sortOfLayer(withAxisLogos(unstacked, "x", { league: "nfl" }), "x")).toMatchObject({ op: "min" });
    const noColor = {
      ...dots,
      encoding: { ...dots.encoding, x: { field: "team", type: "nominal", sort: "-color" } },
    };
    expect(() => withAxisLogos(noColor, "x", { league: "nfl" })).toThrow(
      /sort "-color" names a channel without a field/,
    );
  });

  test("a layered input's top-level encoding and transform stay with its own layers, not the image layer", () => {
    const spec: VegaLiteSpec = {
      data: { values: [{ epa: 10, sr: -3, k: "a" }] },
      transform: [{ filter: "datum.k === 'a'" }],
      encoding: {
        x: { field: "epa", type: "quantitative" },
        y: { field: "sr", type: "quantitative" },
        color: { field: "k", type: "nominal" },
      },
      layer: [{ mark: "point" }, { mark: "line" }],
    };
    const before = structuredClone(spec);
    const out = withLogos(spec, ROWS, { x: "x", y: "y", team: "team", league: "nfl" });
    expect(spec).toEqual(before);
    expect(out).not.toHaveProperty("encoding");
    expect(out).not.toHaveProperty("transform");
    expect(out.data).toEqual(spec.data);
    expect(out.layer).toEqual([
      { transform: spec.transform, encoding: spec.encoding, layer: spec.layer },
      expect.objectContaining({ name: "sdvplot_logo" }),
    ]);
    expect(drawnMarks(out)).toHaveLength(2);
    const vg = compile(out as Parameters<typeof compile>[0]).spec;
    const color = vg.scales!.find((s) => s.name === "color")!;
    // the images' dataset (and what derives from it) feeds no colour category: no empty legend entry
    const images = vg.data!.find((d) => JSON.stringify(d).includes("sdvplot_url"))!.name;
    const fromImages = [
      images,
      ...vg.data!.filter((d) => "source" in d && d.source === images).map((d) => d.name),
    ];
    for (const name of fromImages) expect(JSON.stringify(color.domain)).not.toContain(`"data":"${name}"`);
    expect(JSON.stringify(color.domain)).toContain('"field":"k"');
  });

  test("a discrete y axis needs an explicit height; aggregate/bin encodings cannot be copied; facet/concat/repeat refused", () => {
    const o = { x: "x", y: "y", team: "team", league: "nfl" } as const;
    expect(() =>
      withLogos(
        {
          data: { values: [] },
          mark: "bar",
          encoding: { y: { field: "team", type: "nominal" }, x: { field: "w", type: "quantitative" } },
        },
        ROWS,
        o,
      ),
    ).toThrow(/discrete y axis is sized by its step; set the chart height/);
    expect(() =>
      withLogos(
        {
          ...points(),
          encoding: {
            x: { field: "epa", type: "quantitative", aggregate: "mean" },
            y: { field: "sr", type: "quantitative" },
          },
        },
        ROWS,
        o,
      ),
    ).toThrow(/aggregate="mean", which the logo layer cannot copy/);
    expect(() => withLogos({ facet: { field: "f" }, spec: points() }, ROWS, o)).toThrow(
      /cannot draw on a facet spec; draw on one of its charts \(spec\.spec\)/,
    );
    expect(() => withLogos({ hconcat: [points()] }, ROWS, o)).toThrow(/hconcat\[i\]/);
    expect(() => withLogos(null as unknown as VegaLiteSpec, ROWS, o)).toThrow(UnsupportedTargetError);
  });

  test("timeUnit is copied; the temporal position is written as an ISO string", () => {
    const out = withLogos(
      {
        ...points(),
        encoding: {
          x: { field: "d", type: "temporal", timeUnit: "yearmonth" },
          y: { field: "sr", type: "quantitative" },
        },
      },
      [{ x: new Date(Date.UTC(2024, 0, 15)), y: -3, team: KC }],
      { x: "x", y: "y", team: "team", league: "nfl" },
    );
    const layer = out.layer![1] as {
      encoding: { x: { timeUnit: string } };
      data: { values: { d: unknown }[] };
    };
    expect(layer.encoding.x.timeUnit).toBe("yearmonth");
    expect(layer.data.values[0]!.d).toBe("2024-01-15T00:00:00.000Z");
  });

  test("unknown team: one warning and skipped; wordmarks and headshots; embed", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const out = withLogos(points(), ROWS_UNKNOWN, { x: "x", y: "y", team: "team", league: "nfl" });
    setWarningHandler(null);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(drawnMarks(out).map((m) => m[0])).toEqual([ID(KC)]);
    expect(
      (
        withWordmarks(points(), ROWS, { x: "x", y: "y", team: "team", league: "nfl" }).layer![1] as {
          name: string;
        }
      ).name,
    ).toBe("sdvplot_wordmark");
    const hs = withHeadshots(points(), [{ x: 10, y: -3, player: "3139477" }], {
      x: "x",
      y: "y",
      player: "player",
      league: "nfl",
      height: 0.2,
    });
    expect(drawnMarks(hs)[0]!.slice(0, 4)).toEqual(["3139477", 10, -3, 0.2]);
    const url = drawnMarks(out)[0]![4];
    expect(
      drawnMarks(
        withLogos(points(), [ROWS[0]], {
          x: "x",
          y: "y",
          team: "team",
          league: "nfl",
          embed: new Map([[url, "data:image/png;base64,QQ=="]]),
        }),
      )[0]![4],
    ).toBe("data:image/png;base64,QQ==");
  });

  test("logoLayer stands alone with its own x/y fields and chartHeight", () => {
    const layer = logoLayer(ROWS, {
      x: "x",
      y: "y",
      team: "team",
      league: "nfl",
      height: 0.1,
      chartHeight: 200,
    });
    expect(layer.mark.height).toBe(20);
    expect(layer.encoding).toMatchObject({
      x: { field: "x", type: "quantitative" },
      y: { field: "y", type: "quantitative" },
    });
    expect(() => logoLayer(ROWS, { x: "x", y: "y", team: "team", league: "nfl", chartHeight: -1 })).toThrow(
      /positive number of pixels/,
    );
  });

  test("the patched spec compiles with vega-lite to a Vega spec containing an image mark", () => {
    const out = withLogos(points(), ROWS, { x: "x", y: "y", team: "team", league: "nfl" });
    const vg = compile(out as Parameters<typeof compile>[0]).spec;
    const marks = JSON.stringify(vg.marks);
    expect(marks).toContain('"type":"image"');
    expect(marks).toContain("sdvplot_url");
  });
});

describe("withAxisLogos", () => {
  const bars = (labels: string[], extra: Record<string, unknown> = {}): VegaLiteSpec => ({
    data: { values: labels.map((t, i) => ({ team: t, w: i + 1 })) },
    mark: "bar",
    encoding: {
      x: { field: "team", type: "nominal", sort: null, ...extra },
      y: { field: "w", type: "quantitative" },
    },
  });

  test("x axis: labelExpr blanks only resolved labels, labelPadding grows, images hang below the plot", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const out = withAxisLogos({ ...bars(["KC", "XXX", "BUF"]), height: 200 }, "x", {
      league: "nfl",
      height: 0.1,
    });
    setWarningHandler(null);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(drawnAxisMarks(out, "x")).toEqual([
      [ID(KC), 0, 0.1],
      [ID(BUF), 2, 0.1],
    ]);
    expect(visibleAxisLabels(out, "x")).toEqual(["XXX"]);
    const axis = (
      (out.layer![0] as VegaLiteSpec).encoding!.x as { axis: { labelExpr: string; labelPadding: number } }
    ).axis;
    expect(axis.labelExpr).toBe(`indexof(["KC","BUF"], datum.label) >= 0 ? '' : datum.label`);
    expect(axis.labelPadding).toBe(2 + 20 + 6);
    const layer = out.layer![1] as {
      name: string;
      mark: { baseline: string; height: number };
      encoding: { y: { value: number }; x: { field: string; sort: unknown } };
    };
    expect(layer.name).toBe("sdvplot_axis_x");
    expect(layer.mark).toMatchObject({ baseline: "top", height: 20 });
    expect(layer.encoding.y).toEqual({ value: 206 });
    expect(layer.encoding.x).toMatchObject({ field: "team", sort: null });
  });

  test("y axis: images end left of the axis; an existing labelExpr is wrapped; the axis titles survive the layer", () => {
    const spec: VegaLiteSpec = {
      height: 100,
      data: { values: [{ team: "KC", w: 1 }] },
      mark: "bar",
      encoding: {
        y: {
          field: "team",
          type: "nominal",
          title: "Team",
          axis: { labelExpr: "upper(datum.label)", labelPadding: 4 },
        },
        x: { field: "w", type: "quantitative", title: "Wins" },
      },
    };
    const out = withAxisLogos(spec, "y", { league: "nfl", height: 0.1 });
    const yAxis = (out.layer![0] as VegaLiteSpec).encoding!.y as {
      title: string;
      axis: { labelExpr: string; labelPadding: number };
    };
    expect(yAxis.title).toBe("Team");
    expect(yAxis.axis.labelExpr).toBe(`indexof(["KC"], datum.label) >= 0 ? '' : (upper(datum.label))`);
    expect(yAxis.axis.labelPadding).toBeGreaterThan(4 + 10);
    const layer = out.layer![1] as { mark: { align: string }; encoding: { x: { value: number } } };
    expect(layer.mark.align).toBe("right");
    expect(layer.encoding.x).toEqual({ value: -6 });
  });

  test("categories come from scale.domain or sort list, else inline data in sort order; no data and no list raises", () => {
    expect(
      drawnAxisMarks(
        withAxisLogos({ ...bars(["BUF", "KC"], { scale: { domain: ["KC", "BUF"] } }), height: 100 }, "x", {
          league: "nfl",
        }),
        "x",
      ).map((m) => m[1]),
    ).toEqual([0, 1]);
    expect(
      drawnAxisMarks(
        withAxisLogos({ ...bars(["BUF", "KC"], { sort: "ascending" }), height: 100 }, "x", { league: "nfl" }),
        "x",
      ).map((m) => m[0]),
    ).toEqual([ID(BUF), ID(KC)]);
    expect(() =>
      withAxisLogos(
        {
          height: 100,
          data: { url: "x.csv" },
          mark: "bar",
          encoding: { x: { field: "team", type: "nominal" }, y: { field: "w", type: "quantitative" } },
        },
        "x",
        { league: "nfl" },
      ),
    ).toThrow(/explicit sort=\[\.\.\.\] list/);
  });

  test("needs a discrete axis that is not hidden", () => {
    expect(() => withAxisLogos(points(), "x", { league: "nfl" })).toThrow(
      /needs a nominal or ordinal x axis/,
    );
    expect(() => withAxisLogos(bars(["KC"], { axis: null }), "x", { league: "nfl" })).toThrow(
      /x axis is hidden/,
    );
  });

  test("teamColorScale: domain is the values given, range their colours (fallback for unknown)", () => {
    const s = teamColorScale("nfl", [KC, "XXX", BUF], { fallback: "#999999" });
    expect(s.domain).toEqual([KC, "XXX", BUF]);
    expect(s.range[1]).toBe("#999999");
    expect(s.range[0]).toMatch(/^#/);
  });
});
