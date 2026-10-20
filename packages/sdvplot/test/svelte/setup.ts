// Only under jsdom (svelte-env.test.ts runs in Node, with neither).
if (typeof window !== "undefined") {
  // jsdom has no matchMedia, which svelte/motion reads when LayerChart imports it (prefers-reduced-motion).
  window.matchMedia ??= (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  // nor ResizeObserver, which Svelte's bind:clientWidth (LayerChart's container measurement) uses: a fixed-size chart
  // (`width` / `height` props) never needs it to fire.
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
