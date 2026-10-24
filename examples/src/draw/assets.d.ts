/** webpack (Docusaurus' font rule) resolves a font import to its URL. */
declare module "*.ttf" {
  const url: string;
  export default url;
}

/** webpack (Docusaurus' CSS rule) bundles a stylesheet import. */
declare module "*.css";

/** The two calls the docs make; plotly.js ships no types for its dist bundles. */
declare module "plotly.js-basic-dist-min" {
  const Plotly: {
    newPlot(
      root: HTMLElement,
      data: readonly object[],
      layout?: object,
      config?: object,
    ): Promise<HTMLElement>;
    purge(root: HTMLElement): void;
  };
  export default Plotly;
}

/** A Svelte component: Svelte compiles it (vite-plugin-svelte in the gate, svelte-loader in the docs). tsc cannot read
 *  one, so its props are not checked here; svelte-check types sdvplot's own (packages/sdvplot tsconfig.svelte.json). */
declare module "*.svelte" {
  import type { Component } from "svelte";
  // biome-ignore lint/suspicious/noExplicitAny: any component's props
  const component: Component<any>;
  export default component;
}

/** A stylesheet import (Docusaurus' CSS rule bundles it). */
declare module "*.css";
