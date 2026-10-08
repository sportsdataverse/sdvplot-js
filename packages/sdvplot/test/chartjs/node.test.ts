// No DOM here: Chart.js renders on @napi-rs/canvas, as a server rendering a PNG does.
import { readFile, writeFile } from "node:fs/promises";
import { type Image, createCanvas, loadImage } from "@napi-rs/canvas";
import { Chart, type ChartConfiguration, registerables } from "chart.js";
import { beforeAll, describe, expect, test } from "vitest";
import { axisLogos, logoPoints, logoWatermarks, pointImages } from "../../src/chartjs.js";
import { UnsupportedTargetError, loadLeague, resetWarnings, setWarningHandler } from "../../src/index.js";

Chart.register(...registerables);
beforeAll(async () => {
  await loadLeague("mlb");
});
/** The committed archive copy of a mark URL (named by its sha256, as on the CDN), through @napi-rs/canvas's loadImage. */
const fromFixtures = async (url: string): Promise<Image> =>
  loadImage(
    await readFile(new URL(`../../../../fixtures/sdvplot/logos/${url.split("/").pop()}`, import.meta.url)),
  );
/** A loader that records each URL and promise it hands out (the README recipe awaits the promises). */
function recording(load: (url: string) => Promise<Image> = fromFixtures) {
  const urls: string[] = [];
  const loads: Promise<Image>[] = [];
  return {
    urls,
    loads,
    load: (url: string) => {
      urls.push(url);
      const p = load(url);
      loads.push(p);
      return p;
    },
  };
}
function render(config: ChartConfiguration, width = 600, height = 400) {
  const canvas = createCanvas(width, height);
  const chart = new Chart(canvas as unknown as HTMLCanvasElement, {
    ...config,
    options: { ...config.options, responsive: false, animation: false, devicePixelRatio: 1 },
  });
  return { canvas, chart };
}
type Box = { x: number; y: number; w: number; h: number };
/** Coloured pixels (the logo's blue, not the grey grid, axes and text) inside `box`, read back from a decoded PNG. */
async function inked(png: Buffer, boxes: Box[]): Promise<{ inside: number[]; outside: number }> {
  const img = await loadImage(png);
  const g = createCanvas(img.width, img.height).getContext("2d");
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  const inside = boxes.map(() => 0);
  let outside = 0;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const i = 4 * (y * img.width + x);
      const [r, gr, b, a] = [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
      if (a === 0 || Math.max(r, gr, b) - Math.min(r, gr, b) <= 40) continue;
      // a 1 px margin for the anti-aliased edge of an image drawn at a fractional position
      const k = boxes.findIndex(
        (o) => x >= o.x - 1 && x < o.x + o.w + 1 && y >= o.y - 1 && y < o.y + o.h + 1,
      );
      if (k === -1) outside++;
      else inside[k]!++;
    }
  return { inside, outside };
}

describe("loadImage: the image plugins in Node", () => {
  test("a win-probability chart with logo watermarks and logo points renders to PNG once the images land", async () => {
    expect(typeof document).toBe("undefined");
    const { load, loads, urls } = recording();
    const pts = logoPoints(["LAD", "LAD"], { league: "mlb", radius: 16, loadImage: load });
    expect(pts).toEqual({ pointStyle: [false, false], pointRadius: 16 }); // drawn once they land, as an <img> is
    const { canvas, chart } = render({
      type: "scatter",
      data: {
        datasets: [
          {
            data: [
              { x: 2.5, y: 0.7 },
              { x: 4, y: 0.3 },
            ],
            borderColor: "#000000",
            ...pts,
          },
        ],
      },
      options: {
        scales: { x: { min: 0, max: 5 }, y: { min: 0, max: 1 } },
        plugins: { legend: { display: false } },
      },
      plugins: [pointImages, logoWatermarks(["LAD", "LAD"], { league: "mlb", loadImage: load })],
    });
    const ar = chart.chartArea;
    const boxes: Box[] = [
      { x: ar.left + 8, y: ar.top + 8, w: 75, h: 75 }, // the first team, top-left
      { x: ar.left + 8, y: ar.bottom - 8 - 75, w: 75, h: 75 }, // the last team, bottom-left
      ...chart.getDatasetMeta(0).data.map((p) => ({ x: p.x - 16, y: p.y - 16, w: 32, h: 32 })),
    ];
    expect((await inked(canvas.toBuffer("image/png"), boxes)).inside).toEqual([0, 0, 0, 0]); // still loading

    await Promise.all(loads); // the plugins have redrawn by the time anything awaiting the loads resumes
    const png = canvas.toBuffer("image/png");
    if (process.env.SDVPLOT_CHARTJS_PNG) await writeFile(process.env.SDVPLOT_CHARTJS_PNG, png);
    const { inside, outside } = await inked(png, boxes);
    // measured 1598 / 1636 for the 75 px watermarks, 313 / 292 for the 32 px points: half of that is a logo, not noise
    for (const n of inside.slice(0, 2)) expect(n).toBeGreaterThan(800);
    for (const n of inside.slice(2)) expect(n).toBeGreaterThan(150);
    expect(outside).toBe(0); // and nothing coloured anywhere else

    // one load per URL and drawn size: the 75 px watermark and the 32 px point, each shared by both teams' slots
    expect(urls).toHaveLength(2);
    expect(new Set(urls).size).toBe(1);
    const [img] = pts.pointStyle as unknown as [Image];
    expect([img.width, img.height, String(img)]).toEqual([32, 32, "[object HTMLImageElement]"]);
    expect(pts.pointStyle[1]).toBe(img);
    // a later call with the same loader gets the landed image at once, so a chart built now draws it on its first draw
    expect(logoPoints(["LAD"], { league: "mlb", radius: 16, loadImage: load }).pointStyle[0]).toBe(img);
    expect(urls).toHaveLength(2);
    chart.destroy();
  });

  test("a chart destroyed before its images land is neither redrawn nor touched when they do", async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const { load, loads } = recording(async (url) => {
      await gate;
      return fromFixtures(url);
    });
    const chart = (counts: { draws: number; updates: number }) =>
      render(
        {
          type: "scatter",
          data: {
            datasets: [
              { data: [{ x: 1, y: 1 }], ...logoPoints(["LAD"], { league: "mlb", loadImage: load }) },
            ],
          },
          plugins: [
            pointImages,
            logoWatermarks(["LAD"], { league: "mlb", loadImage: load }),
            { id: "count", afterDraw: () => void counts.draws++, beforeUpdate: () => void counts.updates++ },
          ],
        },
        400,
        300,
      ).chart;
    const gone = { draws: 0, updates: 0 };
    const live = { draws: 0, updates: 0 };
    const destroyed = chart(gone);
    const kept = chart(live); // the control: the same images, a chart left alive
    expect([gone, live]).toEqual([
      { draws: 1, updates: 1 },
      { draws: 1, updates: 1 },
    ]);
    destroyed.destroy();
    let touched = false;
    Object.defineProperty(destroyed, "ctx", {
      get: () => {
        touched = true;
        return null;
      },
    });
    release();
    await Promise.all(loads);
    expect(gone).toEqual({ draws: 1, updates: 1 });
    expect(touched).toBe(false); // its listeners were dropped on destroy, not merely guarded
    expect(live.draws).toBeGreaterThan(1); // the watermark redraw and the point-style update both reached it
    expect(live.updates).toBe(2);
    kept.destroy();
  });

  test("axisLogos paints a category tick's logo once it lands", async () => {
    const { load, loads } = recording();
    const { canvas, chart } = render({
      type: "bar",
      data: { labels: ["LAD"], datasets: [{ data: [3], backgroundColor: "#000000" }] },
      options: { plugins: { legend: { display: false } } },
      plugins: [axisLogos("x", { league: "mlb", size: 24, loadImage: load })],
    });
    const x = chart.scales.x!;
    expect(x.ticks.map((t) => t.label)).toEqual([""]); // blanked at once, as with an <img>
    const box = { x: x.getPixelForTick(0) - 12, y: x.top + 8 + 3, w: 24, h: 24 }; // under the tick mark and padding
    await Promise.all(loads);
    const { inside, outside } = await inked(canvas.toBuffer("image/png"), [box]);
    expect(inside[0]).toBeGreaterThan(100);
    expect(outside).toBe(0);
    chart.destroy();
  });

  test("a loader that reuses one image for two drawn sizes warns once and skips the second use", async () => {
    resetWarnings();
    const msgs: string[] = [];
    setWarningHandler((m) => msgs.push(m));
    try {
      const shared = await fromFixtures(
        "aab854c59098d4f465c1c6f31b580f2a38d2ed4f5c0c03df2da76f62f5378dc4.png",
      );
      const { load, loads } = recording(async () => shared);
      const mark = logoWatermarks(["LAD"], { league: "mlb", loadImage: load }); // 75 px first
      const pts = logoPoints(["LAD"], { league: "mlb", radius: 16, loadImage: load }); // then 32 px
      await Promise.all(loads);
      expect(msgs.filter((m) => m.includes("fresh image per call"))).toHaveLength(1);
      expect([shared.width, shared.height]).toEqual([75, 75]);
      expect(pts.pointStyle[0]).toBe(false); // not drawn mis-sized
      void mark;
    } finally {
      setWarningHandler(null);
      resetWarnings();
    }
  });

  test("a frozen image is a failed load: one warning, nothing drawn, no rejection", async () => {
    resetWarnings();
    const msgs: string[] = [];
    setWarningHandler((m) => msgs.push(m));
    try {
      const { load, loads } = recording(async (u) => Object.freeze(await fromFixtures(u)));
      const pts = logoPoints(["LAD"], { league: "mlb", radius: 16, loadImage: load });
      await Promise.all(loads);
      await new Promise((r) => setTimeout(r, 0));
      expect(msgs.filter((m) => m.includes("cannot be sized"))).toHaveLength(1);
      expect(pts.pointStyle[0]).toBe(false);
    } finally {
      setWarningHandler(null);
      resetWarnings();
    }
  });

  test("without loadImage there is still no DOM to build them on: UnsupportedTargetError", () => {
    expect(() => logoPoints(["LAD"], { league: "mlb" })).toThrow(UnsupportedTargetError);
    expect(() => logoWatermarks(["LAD", "LAD"], { league: "mlb" })).toThrow(UnsupportedTargetError);
  });
});
