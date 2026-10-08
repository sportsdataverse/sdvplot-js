/** Server-build stand-in for examples/src/loaders.gen.ts: SSR serves the prerendered markup and never runs examples. */
export const LOADERS: Readonly<Record<string, () => Promise<{ default: unknown }>>> = {};
