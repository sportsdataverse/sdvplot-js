/** Every example module exports `meta` (this shape, as a literal) and a default export: its output. */
export interface ExampleMeta {
  readonly title: string;
  readonly tags: readonly string[];
}
export type ExamplePackage = "sdvplot" | "sporty" | "sdvtables";
/**
 * One registry row, generated from the module (scripts/gen.ts). `code` is the module's own source with `meta`, the
 * contract import and the words `export default` removed: the page shows exactly what the gate ran.
 */
export interface ExampleEntry extends ExampleMeta {
  /** Path under `examples/src` without the extension, e.g. `sdvplot/plot/axis-logos`. Stable: it is the URL. */
  readonly id: string;
  readonly package: ExamplePackage;
  readonly code: string;
  readonly lang: "ts" | "tsx";
  /** Path relative to `examples/`. */
  readonly file: string;
}
/** Tags with behaviour; every other tag is free text for the gallery. */
export const TAG = {
  /** Calls `fetch`: the gate answers from committed fixtures; the docs never re-run it in the browser. */
  network: "network",
  /**
   * Needs Node (jsdom, linkedom, resvg, fs, @napi-rs/canvas): left out of the browser loaders, and the gate runs it
   * without the browser globals (test/run.ts BROWSER_GLOBALS), as Node would.
   */
  node: "node",
  /** Expected to emit an sdvplot warning; the gate fails an example that warns without it, or has it and does not. */
  warns: "warns",
} as const;
/** How the docs show an output: a DOM node (re-run live), a markup string (static), a React element, or a value. */
export type OutputKind = "node" | "markup" | "react" | "value";
/** One prerendered example: what `examples/out/<id>.json` holds and what `<Live>` receives. */
export interface Prerendered extends ExampleEntry {
  readonly kind: OutputKind;
  readonly markup: string;
  /** The example also exports `browser` (a BrowserSpec): its library draws it on the page, over this markup. */
  readonly browser?: true;
}
/**
 * What an adapter example hands the docs to draw in the browser, next to its static default export: the library's
 * own input (`export const browser = { lib: "plotly", figure, label } as const`). `<Live>` loads the library once
 * the example nears the viewport and swaps the static copy for the live chart. The browser runs the example only up
 * to this export (scripts/gen.ts writes that much as its own module), so the static render after it (@napi-rs/canvas,
 * SSR, headless Vega) never reaches the page. `label` is the chart's accessible name (`role="img"`); Vega has none
 * because its SVG names each mark itself (sdvplot's images read "KC logo").
 */
export type BrowserSpec =
  | {
      readonly lib: "plotly";
      readonly figure: {
        readonly data: readonly object[];
        readonly layout?: object;
        readonly config?: object;
      };
      readonly label: string;
    }
  /** A Vega-Lite spec, which vega-embed compiles and draws on the SVG renderer. */
  | { readonly lib: "vega"; readonly spec: object }
  | {
      readonly lib: "echarts";
      readonly option: object;
      readonly width: number;
      readonly height: number;
      readonly label: string;
    }
  /** `config` builds a fresh Chart.js config per chart: Chart.js keeps state on what it is given. */
  | {
      readonly lib: "chartjs";
      readonly config: () => object;
      readonly width: number;
      readonly height: number;
      readonly label: string;
    };
