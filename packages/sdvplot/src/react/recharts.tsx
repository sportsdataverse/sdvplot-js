import { type ComponentType, type ReactElement, Suspense, lazy, useId, useMemo } from "react";
import { OptionalDependencyError, warn } from "../errors.js";
import type { Value } from "../resolve.js";
import type { SurfaceSceneOptions } from "../surfaces.js";
import type { League, SeasonInput } from "../types.js";

/**
 * `<SurfaceBackdrop>` props: the league whose surface to draw, how to paint it (the options of sdvplot's other
 * `surface` functions), and which axes place it. The sporty-specific options are typed loosely, so `sdvplot/react`'s
 * types never name `@sportsdataverse/sporty` (an optional peer); sporty checks them when the surface is built.
 */
export interface SurfaceBackdropProps {
  /** The league whose court, field or rink to draw, e.g. "nba". */
  league: League;
  /** The team whose colours paint the surface. */
  team?: Value;
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
  /** The `xAxisId` of the numeric x axis the surface's units are on. Default 0. */
  xAxisId?: string | number;
  /** The `yAxisId` of the numeric y axis the surface's units are on. Default 0. */
  yAxisId?: string | number;
}

const missing = (peer: string, e: unknown): OptionalDependencyError =>
  new OptionalDependencyError(
    `SurfaceBackdrop needs the optional peer ${peer}, which could not be loaded: pnpm add ${peer}`,
    { cause: e },
  );
type Domain = readonly unknown[] | undefined;
const numeric = (d: Domain): d is readonly [number, number] =>
  d !== undefined &&
  d.length === 2 &&
  d.every((v) => typeof v === "number" && Number.isFinite(v)) &&
  d[1] !== d[0];

/** A scale (when recharts has the hooks) that grows with the value in direction `dir` (+1 left to right, -1 bottom
 *  to top in pixels) and is linear: its midpoint lands half way. */
function linear(scale: ((v: number) => unknown) | undefined, d0: number, d1: number, dir: 1 | -1): boolean {
  if (scale === undefined) return true;
  const [a, m, b] = [d0, (d0 + d1) / 2, d1].map((v) => Number(scale(v)));
  if (![a, m, b].every((v) => Number.isFinite(v))) return true; // not laid out yet: the domain check covers the rest
  return (
    dir * ((b as number) - (a as number)) > 0 &&
    Math.abs((m as number) - ((a as number) + (b as number)) / 2) < 0.5
  );
}

// recharts and sporty load on first render, never with sdvplot/react: a page that draws no backdrop needs neither.
const Backdrop = lazy(async (): Promise<{ default: ComponentType<SurfaceBackdropProps> }> => {
  const [rc, surfaces, svg] = await Promise.all([
    import("recharts").catch((e: unknown) => {
      throw missing("recharts", e);
    }),
    import("../surfaces.js").catch((e: unknown) => {
      throw missing("@sportsdataverse/sporty", e);
    }),
    import("@sportsdataverse/sporty/svg").catch((e: unknown) => {
      throw missing("@sportsdataverse/sporty", e);
    }),
  ]);
  // recharts 3.8 added the scale hooks; before it a reversed or log axis cannot be told apart (documented)
  const noScale = (): undefined => undefined;
  const useXScale: (id?: string | number) => ((v: number) => unknown) | undefined =
    rc.useXAxisScale ?? noScale;
  const useYScale: (id?: string | number) => ((v: number) => unknown) | undefined =
    rc.useYAxisScale ?? noScale;
  function Drawn({ league, xAxisId, yAxisId, ...o }: SurfaceBackdropProps): ReactElement | null {
    const area = rc.usePlotArea();
    const xd: Domain = rc.useXAxisDomain(xAxisId);
    const yd: Domain = rc.useYAxisDomain(yAxisId);
    const sx = useXScale(xAxisId);
    const sy = useYScale(yAxisId);
    const clip = `sdv-surface-${useId().replace(/[^\w-]/g, "")}`;
    // a bigint team id is a `Value`: JSON.stringify throws on bigint, so key it as text
    const key = JSON.stringify(o, (_k, v: unknown) => (typeof v === "bigint" ? `${v}n` : v));
    // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is `o` by value (a fresh object every render)
    const scene = useMemo(() => surfaces.surfaceScene(league, o as SurfaceSceneOptions), [league, key]);
    // undefined: the chart has not laid out yet (the first render), which is not worth a warning
    if (area === undefined || xd === undefined || yd === undefined) return null;
    if (!numeric(xd) || !numeric(yd)) {
      warn(
        "react:SurfaceBackdrop:domain",
        `SurfaceBackdrop draws nothing: both axes must be type="number" with a numeric domain in the surface's units (got x ${JSON.stringify(xd)}, y ${JSON.stringify(yd)})`,
      );
      return null;
    }
    // ponytail: a linear map from the axes' domains (recharts 3.2 hooks): a reversed or log axis is refused, where
    // recharts 3.8's scale hooks can tell (on 3.2 to 3.7 it would draw mirrored or stretched)
    const [dx0, dx1] = xd;
    const [dy0, dy1] = yd;
    if (!linear(sx, dx0, dx1, 1) || !linear(sy, dy0, dy1, -1)) {
      warn(
        "react:SurfaceBackdrop:scale",
        "SurfaceBackdrop draws nothing on a reversed or log axis: use linear, unreversed number axes",
      );
      return null;
    }
    const fx = (v: number): number => area.x + ((v - dx0) / (dx1 - dx0)) * area.width;
    const fy = (v: number): number => area.y + ((dy1 - v) / (dy1 - dy0)) * area.height;
    const [x0, y0, x1, y1] = scene.bbox;
    const width = fx(x1) - fx(x0);
    const height = fy(y0) - fy(y1);
    if (!(width > 0 && height > 0)) {
      warn(
        "react:SurfaceBackdrop:empty",
        `SurfaceBackdrop draws nothing: the surface spans ${width} x ${height} px`,
      );
      return null;
    }
    // toSVG maps the scene's bbox onto its own viewport; placed and stretched over the bbox's pixel rectangle, the
    // surface's units land on the axes' (strokes stay 1 px: non-scaling)
    const drawn = svg
      .toSVG(scene, { width, height })
      .replace("<svg ", `<svg x="${fx(x0)}" y="${fy(y1)}" preserveAspectRatio="none" `);
    return (
      <g data-sdv-surface="" className="sdv-surface">
        <defs>
          <clipPath id={clip}>
            <rect x={area.x} y={area.y} width={area.width} height={area.height} />
          </clipPath>
        </defs>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: sporty's own SVG, its text and colours escaped by toSVG */}
        <g clipPath={`url(#${clip})`} dangerouslySetInnerHTML={{ __html: drawn }} />
      </g>
    );
  }
  return { default: Drawn };
});

/**
 * A team-painted court, field or rink under a Recharts chart's series: place it as a child of the chart (before the
 * series), as Recharts 3 renders any element there (`<Customized>` is deprecated). The surface is drawn in the
 * numeric axes' units: set both axes' `domain` to the surface's bbox (sporty's `surface(...).bbox`) to fill the plot
 * area, or to any range in those units to show part of it. recharts (3.8 or later) and `@sportsdataverse/sporty`
 * load when it first renders, never with `sdvplot/react`; either missing throws `OptionalDependencyError` then. A
 * server render draws nothing (it loads on the client).
 *
 * @example
 * ```tsx
 * import { SurfaceBackdrop } from "@sportsdataverse/sdvplot/react";
 * import { surface } from "@sportsdataverse/sporty";
 * import { Scatter, ScatterChart, XAxis, YAxis } from "recharts";
 *
 * const [x0, y0, x1, y1] = surface("basketball", "nba", { displayRange: "defense" }).bbox;
 * <ScatterChart width={500} height={470}>
 *   <XAxis type="number" dataKey="x" domain={[x0, x1]} hide />
 *   <YAxis type="number" dataKey="y" domain={[y0, y1]} hide />
 *   <SurfaceBackdrop league="nba" team="DEN" displayRange="defense" />
 *   <Scatter data={[{ x: 0, y: 5.25 }]} />
 * </ScatterChart>;
 * ```
 */
export function SurfaceBackdrop(props: SurfaceBackdropProps): ReactElement {
  return (
    <Suspense fallback={null}>
      <Backdrop {...props} />
    </Suspense>
  );
}
