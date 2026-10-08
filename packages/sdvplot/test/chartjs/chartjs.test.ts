// @vitest-environment jsdom
import { Chart, type ChartConfiguration, registerables } from "chart.js";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import {
  axisLogos,
  headshotPoints,
  logoPoints,
  logoWatermarks,
  pointImages,
  teamColor,
  teamFill,
  wordmarkPoints,
} from "../../src/chartjs.js";
import {
  InputError,
  UnsupportedTargetError,
  hex6,
  loadLeague,
  onColor,
  placeSync,
  resetWarnings,
  setWarningHandler,
  teamColorsSync,
} from "../../src/index.js";

Chart.register(...registerables);
type Call = readonly [name: string, args: readonly unknown[]];
const calls = new WeakMap<HTMLCanvasElement, Call[]>();
/** jsdom has no 2D context: answer getContext with a recording fake (sporty canvas.test.ts's fakeCtx, widened by a Proxy to every member Chart.js calls). */
function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const log: Call[] = [];
  calls.set(canvas, log);
  const state: Record<string | symbol, unknown> = {
    canvas,
    font: "10px sans-serif",
    lineWidth: 1,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
  };
  const measureText = (s?: string) => ({
    width: String(s ?? "").length * 6,
    actualBoundingBoxAscent: 7,
    actualBoundingBoxDescent: 2,
  });
  return new Proxy(state, {
    get: (t, k) =>
      k in t
        ? t[k]
        : k === "measureText"
          ? measureText
          : (...a: unknown[]) =>
              void log.push([String(k), [...a, k === "drawImage" ? t.globalAlpha : undefined]]),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
function draw(config: ChartConfiguration): { chart: Chart; log: Call[] } {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  document.body.append(canvas);
  const chart = new Chart(canvas, {
    ...config,
    options: { ...config.options, responsive: false, animation: false, devicePixelRatio: 1 },
  });
  return { chart, log: calls.get(canvas) ?? [] };
}
const warnings: string[] = [];
beforeAll(async () => {
  await loadLeague("nfl");
  await loadLeague("nba");
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return fakeContext(this);
  } as never);
  // jsdom never decodes images: report them loaded so the plugins paint them
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(500);
});
afterEach(() => {
  resetWarnings();
  setWarningHandler(null);
  warnings.length = 0;
});
const collect = () => setWarningHandler((m) => void warnings.push(m));

describe("point styles", () => {
  test("logos: one image per resolved team at 2*radius px tall in data order; unknown -> text canvas; one warning", () => {
    collect();
    const pts = logoPoints(["KC", "XXX", "BUF"], { league: "nfl", radius: 10 });
    const [kc, bad, buf] = pts.pointStyle;
    const url = placeSync([0], [0], ["KC"], { league: "nfl", warn: false })[0]!.url;
    expect(kc).toBeInstanceOf(HTMLImageElement);
    expect((kc as HTMLImageElement).src).toBe(url);
    expect((kc as HTMLImageElement).height).toBe(20);
    expect((kc as HTMLImageElement).crossOrigin).toBe("anonymous");
    expect(bad).toBeInstanceOf(HTMLCanvasElement);
    expect(buf).toBeInstanceOf(HTMLImageElement);
    expect(pts.pointRadius).toBe(10);
    expect(warnings).toHaveLength(1);
    expect(logoPoints(["KC"], { league: "nfl", radius: 10 }).pointStyle[0]).toBe(kc); // cached element
    expect(logoPoints(["XXX"], { league: "nfl", fallback: "circle" }).pointStyle).toEqual(["circle"]);
    expect(() => logoPoints(["KC"], { league: "nfl", radius: 0 })).toThrow(InputError);
  });
  test("wordmarks and the dark variant resolve to images (a team with no dark mark falls back by polarity)", () => {
    const [wm] = wordmarkPoints(["KC"], { league: "nfl", radius: 10 }).pointStyle;
    expect(wm).toBeInstanceOf(HTMLImageElement);
    const [light] = logoPoints(["KC"], { league: "nfl", radius: 10 }).pointStyle;
    const [dark] = logoPoints(["KC"], { league: "nfl", radius: 10, variant: "dark" }).pointStyle;
    expect(dark).toBeInstanceOf(HTMLImageElement);
    expect((dark as HTMLImageElement).height).toBe((light as HTMLImageElement).height);
  });
  test("headshots use the headshot aspect", () => {
    const [h] = headshotPoints(["3139477"], { league: "nfl", radius: 30 }).pointStyle;
    expect((h as HTMLImageElement).height).toBe(60);
    expect((h as HTMLImageElement).width).toBe(Math.round((60 * 600) / 436));
  });
  test("a real scatter Chart draws each image point style at its own size", () => {
    const pts = logoPoints(["KC", "BUF"], { league: "nfl", radius: 12 });
    const { log } = draw({
      type: "scatter",
      data: {
        datasets: [
          {
            data: [
              { x: 1, y: 2 },
              { x: 3, y: 4 },
            ],
            ...pts,
          },
        ],
      },
      plugins: [pointImages],
    });
    const drawn = log.filter(([n]) => n === "drawImage");
    expect(drawn.map(([, a]) => a[0])).toEqual(pts.pointStyle);
    for (const [, a] of drawn) expect(a.slice(3, 5)).toEqual([(a[0] as HTMLImageElement).width, 24]);
  });
  test("SSR: no DOM -> UnsupportedTargetError", () => {
    vi.stubGlobal("document", undefined);
    try {
      expect(() => logoPoints(["XXX"], { league: "nfl" })).toThrow(UnsupportedTargetError);
      expect(() => logoWatermarks(["KC", "BUF"], { league: "nfl" })).toThrow(UnsupportedTargetError);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("team colours", () => {
  test("one string per team, rgba below alpha 1, onColor ink, grey fallback", () => {
    collect();
    const kc = teamColorsSync("nfl", "KC") as string;
    expect(teamColor(["KC", "XXX"], "nfl")).toEqual([hex6(kc, { dropAlpha: true }), "#808080"]);
    expect(warnings).toHaveLength(1); // J28: one per call
    expect(teamFill("KC", "nfl")).toMatch(/^rgba\(\d+, \d+, \d+, 0\.2\)$/);
    expect(teamColor("KC", "nfl", { onColor: true })).toBe(onColor(kc));
    expect(teamColor("KC", "nfl", { which: "secondary" })).toBe(
      hex6(teamColorsSync("nfl", "KC", { which: "secondary" }) as string, { dropAlpha: true }),
    );
    expect(() => teamColor("KC", "nfl", { alpha: 2 })).toThrow(InputError);
  });
});

describe("axisLogos", () => {
  test("resolved category ticks lose their text and gain an image centred on the tick; the caller's ticks object is not mutated", () => {
    collect();
    const ticks = { padding: 5 };
    const config: ChartConfiguration = {
      type: "bar",
      data: { labels: ["KC", "XXX", "BUF"], datasets: [{ data: [3, 2, 1] }] },
      options: { scales: { x: { ticks } } },
      plugins: [axisLogos("x", { league: "nfl", size: 24 })],
    };
    const { chart, log } = draw(config);
    const x = chart.scales.x!;
    expect(x.ticks.map((t) => t.label)).toEqual(["", "XXX", ""]);
    expect(warnings).toHaveLength(1);
    const imgs = log.filter(([n, a]) => n === "drawImage" && (a[4] as number) === 24);
    expect(imgs).toHaveLength(2);
    const [, a0] = imgs[0]!;
    expect((a0[1] as number) + (a0[3] as number) / 2).toBeCloseTo(x.getPixelForTick(0), 6);
    expect(a0[2]).toBeCloseTo(x.top + 8 + 5, 6); // tick mark 8 + the caller's padding 5
    expect(ticks).toEqual({ padding: 5 }); // Chart.js merged a copy of the caller's ticks; axisLogos wired the copy
    // `chart.options = next; chart.update()` (Game on Paper's re-config path) keeps the wiring: it is applied per update
    chart.options = {
      responsive: false,
      animation: false,
      devicePixelRatio: 1,
      scales: { x: { ticks: { padding: 5 } } },
    } as never;
    log.length = 0;
    chart.update();
    expect(chart.scales.x!.ticks.map((t) => t.label)).toEqual(["", "XXX", ""]);
    expect((chart.scales.x!.options as unknown as { ticks: { padding: number } }).ticks.padding).toBe(5 + 24);
    expect(log.filter(([n, a]) => n === "drawImage" && (a[4] as number) === 24)).toHaveLength(2);
    expect(() => axisLogos("z" as "x", { league: "nfl" })).toThrow(InputError);
    expect(() => axisLogos("x", { league: "nfl", size: 0 })).toThrow(InputError);
  });
});

describe("logoWatermarks", () => {
  test("two faint logos: the first team top-left, the last bottom-left of the chart area, under the datasets; one warning", () => {
    collect();
    const plugin = logoWatermarks(["KC", "XXX", "BUF"], { league: "nfl", size: 50 });
    expect(warnings).toHaveLength(1);
    const { chart, log } = draw({
      type: "line",
      data: { labels: [0, 1, 2], datasets: [{ data: [0.5, 0.7, 0.2] }] },
      plugins: [
        plugin,
        { id: "mark", beforeDatasetDraw: (c) => void calls.get(c.canvas)?.push(["dataset", []]) },
      ],
    });
    const a = chart.chartArea;
    const marks = log.filter(([n, arg]) => n === "drawImage" && (arg[4] as number) === 50);
    expect(marks).toHaveLength(2);
    const [[, home], [, away]] = marks as [Call, Call];
    expect(home[1]).toBe(a.left + 8);
    expect(home[2]).toBe(a.top + 8);
    expect(away[1]).toBe(a.left + 8);
    expect(away[2]).toBe(a.bottom - 8 - 50);
    expect(home[3]).toBe((home[0] as HTMLImageElement).width);
    for (const [, arg] of marks) expect(arg[5]).toBe(0.4); // globalAlpha while drawing
    // painted under the datasets: both images land before the first dataset draws
    const firstDataset = log.findIndex(([n]) => n === "dataset");
    expect(firstDataset).toBeGreaterThan(0);
    expect(log.indexOf(marks[1]!)).toBeLessThan(firstDataset);
    // the alpha is scoped: save precedes the first image, restore follows the last (the fake's save/restore are no-ops)
    const i1 = log.indexOf(marks[1]!);
    expect(log.slice(log.indexOf(marks[0]!) - 1, i1 + 2).map(([n]) => n)).toEqual([
      "save",
      "drawImage",
      "drawImage",
      "restore",
    ]);
    expect(() => logoWatermarks(["KC", "BUF"], { league: "nfl", alpha: 2 })).toThrow(InputError);
    expect(() => logoWatermarks(["KC", "BUF"], { league: "nfl", size: -1 })).toThrow(InputError);
  });
});
