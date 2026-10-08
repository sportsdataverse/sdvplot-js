import type { BrowserSpec } from "../../examples/src/contract";

/**
 * Server-build stand-in for examples/src/loaders.gen.ts and browser.gen.ts: SSR serves the prerendered markup and
 * never runs examples.
 */
export const LOADERS: Readonly<Record<string, () => Promise<{ default: unknown }>>> = {};
export const BROWSER: Readonly<Record<string, () => Promise<{ browser: BrowserSpec }>>> = {};
/** Never called on the server (<Live> draws in an effect); keeps the chart libraries out of the server bundle. */
export function draw(_el: HTMLElement, _s: BrowserSpec): Promise<() => void> {
  return Promise.reject(new Error("draw runs in the browser only"));
}
