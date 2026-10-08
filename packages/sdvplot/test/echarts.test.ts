import * as echarts from "echarts";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  type EChartsOption,
  type LogoSeries,
  drawnMarks,
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
  option: EChartsOption,
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
