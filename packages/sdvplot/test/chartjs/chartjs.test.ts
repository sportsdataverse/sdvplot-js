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
  marks,
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
              void log.push([
                String(k),
                [...a, k === "drawImage" ? t.globalAlpha : k === "fillText" ? t.fillStyle : undefined],
              ]),
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
  test("wordmarks and the dark variant resolve to images: the dark logo is the one requested", async () => {
    const [wm] = wordmarkPoints(["KC"], { league: "nfl", radius: 10 }).pointStyle;
    expect(wm).toBeInstanceOf(HTMLImageElement);
    // DAL's dark logo is a different file from its default one (KC's are byte-identical, so they share a URL)
    const [light] = logoPoints(["DAL"], { league: "nfl", radius: 10 }).pointStyle as [HTMLImageElement];
    const [dark] = logoPoints(["DAL"], { league: "nfl", radius: 10, variant: "dark" }).pointStyle as [
      HTMLImageElement,
    ];
    const darkUrls = (await marks("DAL", "nfl"))
      .filter((r) => r.mark_type === "logo" && r.variant === "dark")
      .map((r) => r.archive_url);
    expect(darkUrls.length).toBeGreaterThan(0);
    expect(darkUrls).toContain(dark.src);
    expect(darkUrls).not.toContain(light.src);
    expect(dark.height).toBe(light.height);
  });
  test("the text fallback is inked for the chart background: grey on light, light grey on dark", () => {
    const ink = (o: Partial<Parameters<typeof logoPoints>[1]>): unknown => {
      const [c] = logoPoints(["XXX"], { league: "nfl", ...o }).pointStyle as [HTMLCanvasElement];
      return calls.get(c)?.find(([n]) => n === "fillText")?.[1][3];
    };
    expect(ink({})).toBe("#555555");
    expect(ink({ variant: "dark" })).toBe("#e8e6e3");
    expect(ink({ background: "#1e1e1e" })).toBe("#e8e6e3");
    expect(ink({ variant: "dark", background: "#fafafa" })).toBe("#555555");
    const [h] = headshotPoints([null], { league: "nfl", background: "#000" }).pointStyle as [
      HTMLCanvasElement,
    ];
    expect(calls.get(h)?.find(([n]) => n === "fillText")?.[1][3]).toBe("#e8e6e3");
    expect(() => logoPoints(["KC"], { league: "nfl", background: "dark" })).toThrow(InputError);
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

describe("images that load after the first draw", () => {
  /** A logo no other test uses (its own radius, so a fresh cached element) that reports itself still loading. */
  function loading(radius: number): HTMLImageElement {
    const [img] = logoPoints(["KC"], { league: "nfl", radius }).pointStyle as [HTMLImageElement];
    Object.defineProperty(img, "complete", { value: false, configurable: true });
    return img;
  }
  /** As a browser does: `complete` turns true (the prototype's mock again), then `load` fires. */
  function loaded(img: HTMLImageElement): void {
    Reflect.deleteProperty(img, "complete");
    img.dispatchEvent(new Event("load"));
  }
  /** Two datasets sharing the image, so it is seen twice per draw. */
  function scatter(img: HTMLImageElement) {
    let draws = 0;
    const style = { pointStyle: [img], pointRadius: img.height / 2 };
    const { chart, log } = draw({
      type: "scatter",
      data: {
        datasets: [
          { data: [{ x: 1, y: 2 }], ...style },
          { data: [{ x: 3, y: 4 }], ...style },
        ],
      },
      plugins: [pointImages, { id: "count", afterDraw: () => void draws++ }],
    });
    return { chart, log, draws: () => draws };
  }
  test("a live chart redraws exactly once when the image loads (one listener per image and chart)", () => {
    const img = loading(17);
    const { log, draws } = scatter(img);
    expect(draws()).toBe(1);
    log.length = 0;
    loaded(img);
    img.dispatchEvent(new Event("load"));
    expect(draws()).toBe(2);
    expect(log.filter(([n, a]) => n === "drawImage" && a[0] === img)).toHaveLength(2);
  });
  test("after destroy a late load neither throws nor redraws, and no listener holds the chart", () => {
    const img = loading(19);
    const { chart, draws } = scatter(img);
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => void errors.push(e.error);
    window.addEventListener("error", onError);
    try {
      chart.destroy();
      let touched = false;
      Object.defineProperty(chart, "ctx", {
        get: () => {
          touched = true;
          return null;
        },
      });
      loaded(img);
      expect(errors).toEqual([]);
      expect(draws()).toBe(1);
      expect(touched).toBe(false); // the listener was dropped on destroy, not merely guarded
    } finally {
      window.removeEventListener("error", onError);
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

describe("axisLogos layout", () => {
  test("y-axis wordmarks fit on the canvas and paint before any afterDraw (where Chart.js draws the tooltip)", () => {
    const { chart, log } = draw({
      type: "bar",
      data: { labels: ["KC", "BUF"], datasets: [{ data: [3, 2] }] },
      options: { indexAxis: "y" },
      plugins: [
        // listed first, so its afterDraw would run before an afterDraw of axisLogos'
        { id: "tooltipStandIn", afterDraw: (c) => void calls.get(c.canvas)?.push(["afterDraw", []]) },
        axisLogos("y", { league: "nfl", markType: "wordmark", size: 24 }),
      ],
    });
    const y = chart.scales.y!;
    const imgs = log.filter(([n, a]) => n === "drawImage" && (a[4] as number) === 24);
    expect(imgs).toHaveLength(2);
    for (const [, a] of imgs) {
      expect(a[3] as number).toBeGreaterThan(24); // a wordmark is wider than it is tall
      expect(a[1] as number).toBeGreaterThanOrEqual(0);
      expect(a[1] as number).toBeGreaterThanOrEqual(y.left);
      expect((a[1] as number) + (a[3] as number)).toBeLessThanOrEqual(y.right);
    }
    expect(log.indexOf(imgs[1]!)).toBeLessThan(log.findIndex(([n]) => n === "afterDraw"));
  });
  test("a non-category axis is left alone, with one warning across updates", () => {
    collect();
    const { chart, log } = draw({
      type: "scatter",
      data: {
        datasets: [
          {
            data: [
              { x: 0, y: 1 },
              { x: 1000, y: 2 },
            ],
          },
        ],
      },
      plugins: [axisLogos("x", { league: "nfl" })],
    });
    chart.update();
    expect((chart.scales.x!.options as unknown as { ticks: { padding: number } }).ticks.padding).toBe(3);
    expect(log.some(([n]) => n === "drawImage")).toBe(false);
    expect(warnings).toHaveLength(1);
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
  test("a draw before the first layout (no chartArea yet) is skipped, not a TypeError", () => {
    const canvas = document.createElement("canvas"); // never attached: a responsive chart waits for a layout
    canvas.width = 600;
    canvas.height = 400;
    const chart = new Chart(canvas, {
      type: "line",
      data: { labels: [0], datasets: [{ data: [1] }] },
      options: { animation: false },
      plugins: [logoWatermarks(["KC"], { league: "nfl" })],
    });
    chart.resize(600, 400); // a detached chart applies a pending resize on its next draw, still with no layout
    expect(chart.chartArea).toBeUndefined();
    expect(() => chart.draw()).not.toThrow();
    chart.destroy();
  });
});
