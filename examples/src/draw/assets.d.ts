/** webpack (Docusaurus' font rule) resolves a font import to its URL. */
declare module "*.ttf" {
  const url: string;
  export default url;
}

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
