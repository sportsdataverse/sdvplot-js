import type { ReactElement } from "react";

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
    }
  /** `opts` builds fresh uPlot options per chart; `data` is uPlot's columns (x first, then one array per series). */
  | {
      readonly lib: "uplot";
      readonly opts: () => object;
      readonly data: readonly ArrayLike<number | null | undefined>[];
      readonly width: number;
      readonly height: number;
      readonly label: string;
    }
  /**
   * A Svelte 5 component of examples/snippets/svelte (by file name: the docs show that file), mounted with `props`;
   * it sizes its own LayerChart chart.
   */
  | {
      readonly lib: "svelte";
      readonly component: "BumpChart" | "QbHeadshots" | "CourtShots";
      readonly props: Readonly<Record<string, unknown>>;
      readonly label: string;
    }
  /**
   * deck.gl layers over a sporty surface, drawn top down (an OrthographicView, y up) in the surface's own coordinates
   * and fitted to `bounds` (`[x0, y0, x1, y1]`). `layers` builds fresh props per chart: each names its layer class.
   */
  | {
      readonly lib: "deckgl";
      readonly layers: () => readonly {
        readonly layer: "PolygonLayer" | "IconLayer" | "ArcLayer";
        readonly props: object;
      }[];
      readonly bounds: readonly [x0: number, y0: number, x1: number, y1: number];
      readonly width: number;
      readonly height: number;
      readonly label: string;
    }
  /**
   * A Cytoscape.js graph laid out at its nodes' own positions (the preset layout). `elements` builds a fresh copy per
   * graph (Cytoscape keeps what it is given); `style` is its stylesheet JSON.
   */
  | {
      readonly lib: "cytoscape";
      readonly elements: () => object;
      readonly style: readonly object[];
      readonly width: number;
      readonly height: number;
      readonly label: string;
    }
  /**
   * A react-three-fiber scene (`<Surface3D>`, `<Trajectory>`, ...), drawn in a `<Canvas>` at the example's size. The
   * world is z up: the camera stands at `camera.position` with +z up and looks at `camera.target`; drag to turn it
   * round the target. `scene` builds fresh elements per chart.
   */
  | {
      readonly lib: "three";
      readonly scene: () => ReactElement;
      readonly camera: {
        readonly position: readonly [x: number, y: number, z: number];
        readonly target: readonly [x: number, y: number, z: number];
        /** Vertical field of view, degrees. */
        readonly fov: number;
      };
      readonly width: number;
      readonly height: number;
      readonly label: string;
    }
  /**
   * `mount` is the example's own Lightweight Charts code: it draws into `el` with the module it is handed (the drawer
   * imports it, so the example never does) and returns what it built, the chart, its series and each series'
   * primitives (the render test reads them). It also puts TradingView's attribution notice on the page.
   */
  | {
      readonly lib: "lightweight-charts";
      readonly mount: (
        lwc: typeof import("lightweight-charts"),
        el: HTMLElement,
      ) => {
        readonly chart: { remove(): void };
        readonly series: readonly object[];
        readonly primitives: readonly (readonly object[])[];
      };
      readonly label: string;
    }
  /**
   * A G2 5 spec, drawn by `new Chart({ container, width, height })` and `chart.options(spec())` on G2's canvas
   * renderer. `spec` builds a fresh spec per chart (G2 keeps what it is given).
   */
  | {
      readonly lib: "g2";
      readonly spec: () => object;
      readonly width: number;
      readonly height: number;
      readonly label: string;
    }
  /**
   * An Ant Design Charts element (`<Scatter {...config} />`, `<Line>`, ...), mounted in a React root at the example's
   * width: its config is a G2 spec underneath. `chart` builds a fresh element per chart.
   */
  | {
      readonly lib: "ant-design-charts";
      readonly chart: () => ReactElement;
      readonly width: number;
      readonly height: number;
      readonly label: string;
    };
