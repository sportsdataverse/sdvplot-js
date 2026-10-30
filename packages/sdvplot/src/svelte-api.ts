// Docs only: the typedoc entry point for the `/svelte` subpath (docs/docusaurus.config.ts). That subpath's own index
// re-exports `.svelte` files, which typedoc cannot read, so this file re-exports the TypeScript half under the
// module name `svelte`. tsup does not build it and it is not a package subpath.

/**
 * Svelte 5 components for LayerChart: `LogoMark` (team logos or wordmarks at data points), `HeadshotMark` and
 * `SurfaceBackdrop` (a team-painted court, field or rink in the chart's units), each a child of a LayerChart chart's
 * `<Svg>` layer, plus team colours for the series. The components are `.svelte` files, so this page lists their props
 * and the TypeScript helpers; the Svelte guide (https://plot.sportsdataverse.org/guides/svelte) shows them in use.
 * Import everything from `@sportsdataverse/sdvplot/svelte`.
 * @module svelte
 */
export { embedSources, teamColorPalette } from "./svelte-core.js";
export type {
  HeadshotMarkProps,
  LogoMarkProps,
  Row,
  SurfaceBackdropProps,
  TeamColorPaletteOptions,
} from "./svelte-core.js";
