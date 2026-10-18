/**
 * What the `sdvplot/svelte` components compute, as plain TypeScript (tsup builds it to dist/svelte-core.js, which the
 * components built by svelte-package import as ../svelte-core.js). Internal: not a package subpath; `sdvplot/svelte`
 * re-exports the public part. layerchart, sporty and the surface code are imported here only, and only lazily.
 */
import {
  type HeadshotOptions,
  type MarkOptions,
  type Row,
  aspect,
  colorList,
  imageSource,
  markPlacements,
} from "./_web.js";
import { hex6 } from "./contrast.js";
import { OptionalDependencyError, warn } from "./errors.js";
import { type Kind, type Placement, checkAlpha, checkHeight, placedName } from "./placement.js";
import type { SurfaceSceneOptions } from "./surfaces.js";
import { teamPalette } from "./team-palette.js";
import type { IdSystem, League, MarkType, SeasonInput, Which } from "./types.js";
export type { Row } from "./_web.js";
export { embedSources } from "./_web.js"; // public via sdvplot/svelte: build `embed` with it, as for the other adapters

/** `<LogoMark>` props: the shared mark options (`x`, `y`, `team`, `league`, `height` a fraction of the plot height,
 *  ...) plus the rows to mark and the mark type. */
export interface LogoMarkProps extends MarkOptions {
  /** The rows to mark. Default: the chart's own `data`. */
  data?: readonly Row[];
  /** "logo" (default) or "wordmark". */
  markType?: MarkType;
}
/** `<HeadshotMark>` props: the shared headshot options (`x`, `y`, `player`, `league`, `height`, ...) plus the rows. */
export interface HeadshotMarkProps extends HeadshotOptions {
  /** The rows to mark. Default: the chart's own `data`. */
  data?: readonly Row[];
}
/**
 * `<SurfaceBackdrop>` props: the league whose surface to draw and how to paint it (the options of sdvplot's other
 * `surface` functions). The sporty-specific options are typed loosely, so these types never name
 * `@sportsdataverse/sporty` (an optional peer); sporty checks them when the surface is built.
 */
export interface SurfaceBackdropProps {
  /** The league whose court, field or rink to draw, e.g. "nba". */
  league: League;
  /** The team whose colours paint the surface. */
  team?: string | number;
  /** The season the team's colours are taken from. */
  season?: SeasonInput;
  /** Overrides on top of the team painting, keyed by sporty colour key (e.g. `{ painted_area: "#0e2240" }`). */
  colorUpdates?: Readonly<Record<string, string>>;
  /** Degrees to rotate the surface by. */
  rotation?: number;
  /** A sporty display range for the league's sport, e.g. "defense"; one the sport does not know throws. */
  displayRange?: string;
  xlim?: readonly [number, number];
  ylim?: readonly [number, number];
  units?: "ft" | "m" | "yd" | "in" | "cm" | "mm";
  /** Sporty parameter overrides for the league's surface. */
  updates?: Readonly<Record<string, unknown>>;
  arcResolution?: number;
  xTrans?: number;
  yTrans?: number;
}

/** A LayerChart scale: what the marks call (a d3 scale; a band scale has a bandwidth). */
export interface ChartScale {
  (v: unknown): unknown;
  domain(): unknown[];
  bandwidth?: () => number;
}
/** The part of LayerChart's chart context the components read: the scales, the plot area's size and the data. */
export interface ChartContext {
  xScale: ChartScale;
  yScale: ChartScale;
  width: number;
  height: number;
  data?: unknown;
}
/** The part of the layerchart module the components use. */
export interface LayerChart {
  getChartContext(): ChartContext;
}

const missing = (component: string, peer: string, e: unknown): OptionalDependencyError =>
  new OptionalDependencyError(
    `${component} needs the optional peer ${peer}, which could not be loaded: pnpm add ${peer}`,
    { cause: e },
  );
let layerchart: Promise<LayerChart> | undefined;
/** layerchart, imported on first use (never with `sdvplot/svelte`); a missing peer rejects with an install message. */
export function loadLayerChart(component: string): Promise<LayerChart> {
  layerchart ??= import("layerchart") as Promise<LayerChart>;
  return layerchart.catch((e: unknown) => {
    layerchart = undefined; // installed later (a dev server): the next render tries again
    throw missing(component, "layerchart", e);
  });
}
/** Throws `e`: a component rethrows a failed import from its template (an effect), so a `<svelte:boundary>` catches
 *  it (an error thrown from a promise callback would bypass the boundary). */
export function raise(e: unknown): never {
  throw e;
}

/** An `<image>` to draw: its attributes, including the `data-sdv-*` stamps `sdvplot/testing`'s `drawnMarks` reads. */
export interface MarkImage {
  key: string;
  attrs: Record<string, string | number>;
}
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** A value's pixel on a scale: the middle of its band on a band scale. undefined off the scale. */
function pixel(scale: ChartScale, v: unknown): number | undefined {
  const at = scale(v);
  return finite(at) ? at + (scale.bandwidth?.() ?? 0) / 2 : undefined;
}
/** A data value as the `data-sdv-x/y` text drawnMarks reads back: a Date as its time in ms (as sdvplot/plot). */
const stamp = (v: unknown): string => String(v instanceof Date ? v.getTime() : v);

/**
 * The images a mark component draws in the chart `ctx`: one per row whose team (or player) has an image, centred on
 * the row's scaled (x, y), `height` of the plot area tall. A row with no image is skipped with one warning (placeSync),
 * as `sdvplot/echarts` does. Nothing is drawn before the chart has a size.
 */
export function markImages(ctx: ChartContext, kind: Kind, o: LogoMarkProps | HeadshotMarkProps): MarkImage[] {
  const h = checkHeight(o.height ?? 0.1);
  const alpha = checkAlpha(o.alpha ?? 1);
  const rows = o.data ?? (Array.isArray(ctx.data) ? (ctx.data as Row[]) : []);
  if (!(ctx.height > 0)) return [];
  const size = h * ctx.height;
  const ps: Placement[] = markPlacements(rows, kind, o);
  const raw = kind === "headshot" ? (o as HeadshotMarkProps).player : (o as LogoMarkProps).team;
  return ps.flatMap((p) => {
    const cx = pixel(ctx.xScale, p.x);
    const cy = pixel(ctx.yScale, p.y);
    if (cx === undefined || cy === undefined) return [];
    const w = size * aspect(p);
    return [
      {
        key: `${p.index}:${p.id}`,
        attrs: {
          href: imageSource(p, o.embed),
          x: cx - w / 2,
          y: cy - size / 2,
          width: w,
          height: size,
          preserveAspectRatio: "xMidYMid meet",
          ...(alpha === 1 ? {} : { opacity: alpha }),
          role: "img",
          "aria-label": `${placedName(p, o.league, rows[p.index]?.[raw])} ${kind}`,
          "data-sdv-id": p.id,
          "data-sdv-kind": kind,
          "data-sdv-x": stamp(p.x),
          "data-sdv-y": stamp(p.y),
          "data-sdv-frame": ctx.height,
        },
      },
    ];
  });
}

/** The surface code (sdvplot's surfaces, sporty's SVG writer) and layerchart, imported when a backdrop first renders. */
export interface SurfaceKit {
  lc: LayerChart;
  scene(league: League, o: SurfaceSceneOptions): { bbox: readonly [number, number, number, number] };
  toSVG(scene: never, o: { width: number; height: number }): string;
}
export async function loadSurfaceKit(): Promise<SurfaceKit> {
  const [lc, surfaces, svg] = await Promise.all([
    loadLayerChart("SurfaceBackdrop"),
    import("./surfaces.js").catch((e: unknown) => {
      throw missing("SurfaceBackdrop", "@sportsdataverse/sporty", e);
    }),
    import("@sportsdataverse/sporty/svg").catch((e: unknown) => {
      throw missing("SurfaceBackdrop", "@sportsdataverse/sporty", e);
    }),
  ]);
  return {
    lc,
    scene: surfaces.surfaceScene,
    toSVG: svg.toSVG as unknown as SurfaceKit["toSVG"],
  };
}

/**
 * The backdrop's SVG over the plot area: the scene's bbox mapped through the chart's scales, so the surface's units
 * land on the axes'. A scale that is not numeric, reversed or not linear draws nothing (one warning): a mirrored or
 * stretched court would mislead.
 */
export function surfaceMarkup(
  ctx: ChartContext,
  kit: SurfaceKit,
  scene: ReturnType<SurfaceKit["scene"]>,
): string | null {
  if (!(ctx.width > 0 && ctx.height > 0)) return null;
  const [sx, sy] = [ctx.xScale, ctx.yScale];
  const numeric = (s: ChartScale): boolean => s.bandwidth === undefined && s.domain().every(finite);
  if (!numeric(sx) || !numeric(sy)) {
    warn(
      "svelte:SurfaceBackdrop:domain",
      "SurfaceBackdrop draws nothing: both scales must be numeric (linear), in the surface's units",
    );
    return null;
  }
  // x grows left to right and y bottom to top in pixels, each linearly: its midpoint lands half way
  const linear = (s: ChartScale, dir: 1 | -1): boolean => {
    const [d0, d1] = s.domain() as [number, number];
    const [a, m, b] = [d0, (d0 + d1) / 2, d1].map((v) => Number(s(v))) as [number, number, number];
    return dir * (b - a) * Math.sign(d1 - d0) > 0 && Math.abs(m - (a + b) / 2) < 0.5;
  };
  if (!linear(sx, 1) || !linear(sy, -1)) {
    warn(
      "svelte:SurfaceBackdrop:scale",
      "SurfaceBackdrop draws nothing on a reversed or log scale: use linear, unreversed scales",
    );
    return null;
  }
  const [x0, y0, x1, y1] = scene.bbox;
  const [left, right, top, bottom] = [sx(x0), sx(x1), sy(y1), sy(y0)].map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const [width, height] = [right - left, bottom - top];
  if (!(width > 0 && height > 0)) {
    warn(
      "svelte:SurfaceBackdrop:empty",
      `SurfaceBackdrop draws nothing: the surface spans ${width} x ${height} px`,
    );
    return null;
  }
  // toSVG maps the scene's bbox onto its own viewport; placed and stretched over the bbox's pixel rectangle, the
  // surface's units land on the scales' (strokes stay 1 px: non-scaling)
  return kit
    .toSVG(scene as never, { width, height })
    .replace("<svg ", `<svg x="${left}" y="${top}" preserveAspectRatio="none" `);
}

/** `teamColorPalette` options. */
export interface TeamColorPaletteOptions {
  which?: Which;
  season?: SeasonInput;
  idSystem?: IdSystem;
  /** The colour of an unresolved team. Default "#808080". */
  fallback?: string;
  /**
   * The chart's background. Given, a team colour under 3:1 contrast against it is swapped for the team's other
   * colour, else moved towards white (on a dark background) or black (a light one) until it reads: dark mode. A
   * colour that would then sit too close to an earlier team's (CIE76 ΔE under 20) takes the team's other colour, or
   * the nearest colour to its own (lightness, hue or chroma stepped) that is distinct and still reads; failing that it
   * is kept, with one warning.
   */
  background?: string;
}
/**
 * One colour per team, in order: a LayerChart series' `color`, a `<Spline stroke>`, or the chart's `cRange`. With
 * `background`, every colour keeps 3:1 contrast against it (dark mode) and stays distinct from the others.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColorPalette } from "@sportsdataverse/sdvplot/svelte";
 *
 * await loadLeague("nfl");
 * teamColorPalette("nfl", ["KC", "LAC", "DEN", "LV"], { background: "#181a1b" });
 * ```
 */
export function teamColorPalette(
  league: League,
  teams: readonly unknown[],
  o: TeamColorPaletteOptions = {},
): string[] {
  const fallback = o.fallback ?? "#808080";
  const co = {
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  };
  const main = colorList(league, teams, { ...co, ...(o.which === undefined ? {} : { which: o.which }) });
  const bg = o.background === undefined ? undefined : hex6(o.background);
  if (bg === undefined) return main.map((c) => c ?? fallback);
  const other = colorList(league, teams, { ...co, which: o.which === "secondary" ? "primary" : "secondary" });
  const colors = main.map((c) => hex6(c ?? fallback, { dropAlpha: true }));
  return teamPalette(colors, other, bg, teams.map(String));
}
