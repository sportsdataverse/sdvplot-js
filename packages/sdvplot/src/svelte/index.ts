/**
 * Svelte 5 components for LayerChart: team logos and player headshots as marks, a team-painted surface as a
 * backdrop, and team colours for the series. Each component is a child of a LayerChart chart's `<Svg>` layer; it
 * loads layerchart (an optional peer) when it first renders, never on import. Call `loadLeague(league)` /
 * `preloadAll()` first, as for the other adapters.
 * @packageDocumentation
 */
export { default as HeadshotMark } from "./HeadshotMark.svelte";
export { default as LogoMark } from "./LogoMark.svelte";
export { default as SurfaceBackdrop } from "./SurfaceBackdrop.svelte";
export { embedSources, teamColorPalette } from "../svelte-core.js";
export type {
  HeadshotMarkProps,
  LogoMarkProps,
  Row,
  SurfaceBackdropProps,
  TeamColorPaletteOptions,
} from "../svelte-core.js";
