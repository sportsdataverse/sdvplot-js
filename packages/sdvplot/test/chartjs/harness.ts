import { Chart, type ChartConfiguration } from "chart.js";
import { vi } from "vitest";

export type Call = readonly [name: string, args: readonly unknown[]];
export const calls: WeakMap<HTMLCanvasElement, Call[]> = new WeakMap<HTMLCanvasElement, Call[]>();
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
export function draw(config: ChartConfiguration): { chart: Chart; log: Call[] } {
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
/** Mocks jsdom's missing 2D context and image decoding; call from beforeAll. */
export function mockCanvas(): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return fakeContext(this);
  } as never);
  // jsdom never decodes images: report them loaded so the plugins paint them
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(500);
}
