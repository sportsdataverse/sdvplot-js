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
}
