import type { BrowserSpec } from "../contract.js";

type Of<L extends BrowserSpec["lib"]> = Extract<BrowserSpec, { lib: L }>;
/** One library's drawing: put the chart in `el` and return what removes it. */
export type Draw<L extends BrowserSpec["lib"]> = (el: HTMLElement, s: Of<L>) => Promise<() => void>;

/**
 * Draw a browser upgrade into `el` with its library, imported on first use. Each library is its own chunk, named
 * after the draw module that alone imports it (docs/plugins/sdv-examples.ts splits `lib-<lib>` out of `draw-<lib>`),
 * so only a page that shows one loads it. Resolves to what removes the chart.
 */
export async function draw(el: HTMLElement, s: BrowserSpec): Promise<() => void> {
  // Its own slot: a drawing that throws (or one a newer drawing replaced) removes what it drew and nothing else.
  const slot = el.appendChild(document.createElement("div"));
  try {
    const remove = await drawWith(slot, s);
    return () => {
      remove();
      slot.remove();
    };
  } catch (e) {
    slot.remove();
    throw e;
  }
}

async function drawWith(el: HTMLElement, s: BrowserSpec): Promise<() => void> {
  switch (s.lib) {
    case "plotly":
      return (await import(/* webpackChunkName: "draw-plotly" */ "./plotly.js")).default(el, s);
    case "vega":
      return (await import(/* webpackChunkName: "draw-vega" */ "./vega.js")).default(el, s);
    case "echarts":
      return (await import(/* webpackChunkName: "draw-echarts" */ "./echarts.js")).default(el, s);
    case "chartjs":
      return (await import(/* webpackChunkName: "draw-chartjs" */ "./chartjs.js")).default(el, s);
  }
}

/** A fixed-size chart's box in `el`, named for assistive technology: these charts have no accessible name of their own. */
export function figureBox(el: HTMLElement, label: string, role: "img" | "figure" = "img"): HTMLDivElement {
  const box = el.appendChild(document.createElement("div"));
  box.setAttribute("role", role);
  box.setAttribute("aria-label", label);
  return box;
}
