import * as Plot from "@observablehq/plot";
import type { EspnHeadshotLeague } from "../headshots.js";
import { type Kind, type Placement, checkAlpha, checkHeight, placeSync } from "../placement.js";
import type { Value } from "../resolve.js";
import type { HeadshotIdSystem, IdSystem, League, SeasonInput, Variant } from "../types.js";

/** A column name, an accessor, or an array of values (one per row). */
export type Channel<R> = keyof R | ((d: R, i: number) => Value) | readonly Value[];
/** Rows to draw: any iterable, or an Arrow-like table `Plot.valueof` accepts. */
export type Data<R> = Iterable<R> | { numRows: number };
export interface MarkOptions<R> {
  league: League;
  x: Channel<R>;
  y: Channel<R>;
  team: Channel<R>;
  season?: SeasonInput | Channel<R>;
  /** Fraction of the (facet) frame height in (0, 1]; default 0.1. */
  height?: number;
  /** Opacity in [0, 1]; default 1. */
  alpha?: number;
  variant?: Variant;
  idSystem?: IdSystem;
  title?: Channel<R>;
  ariaLabel?: string;
}
export interface HeadshotOptions<R> {
  league: EspnHeadshotLeague;
  x: Channel<R>;
  y: Channel<R>;
  player: Channel<R>;
  height?: number;
  alpha?: number;
  /** "espn" (default) or "gsis". "gsis" is sync and needs `loadGsis()` to have run first, else this throws InputError. */
  idSystem?: HeadshotIdSystem;
  title?: Channel<R>;
  ariaLabel?: string;
}

const values = <R>(data: Data<R>, c: Channel<R>): Value[] =>
  Plot.valueof(data as Plot.Data, c as Plot.ChannelValue) as Value[];

/**
 * Plot `render` transform: size each `<image>` to `height` x the (facet) frame height, keep the mark's
 * aspect, re-centre on the point and stamp the `data-sdv-*` attributes `drawnMarks` reads.
 * `placed` is looked up by original row index (`Placement.index`), which is what Plot hands `render`.
 */
export function sizeRender(height: number, placed: readonly Placement[], kind: Kind): Plot.RenderFunction {
  const byRow = new Map(placed.map((p) => [p.index, p]));
  return (index, scales, vals, dimensions, context, next) => {
    const g = next?.(index, scales, vals, dimensions, context) as SVGElement | null | undefined;
    if (g == null) return null;
    const frame = dimensions.height - dimensions.marginTop - dimensions.marginBottom;
    const px = height * frame;
    const X = vals.x as ArrayLike<number>;
    const Y = vals.y as ArrayLike<number>;
    const images = g.querySelectorAll("image");
    index.forEach((i, k) => {
      const img = images[k];
      const p = byRow.get(i);
      if (!img || !p) return;
      const w = px * (p.aspect ?? 1);
      img.setAttribute("width", String(w));
      img.setAttribute("height", String(px));
      img.setAttribute("x", String((X[i] as number) - w / 2));
      img.setAttribute("y", String((Y[i] as number) - px / 2));
      img.setAttribute("data-sdv-id", p.id);
      img.setAttribute("data-sdv-x", String(p.x));
      img.setAttribute("data-sdv-y", String(p.y));
      img.setAttribute("data-sdv-kind", kind);
      img.setAttribute("data-sdv-frame", String(frame));
    });
    return g;
  };
}

// The mark is built on the caller's own data (not on the placements) so Plot's top-level
// `facet: {data}` identity check applies; channels are row-aligned, null where a row is skipped.
function imageMark<R>(
  data: Data<R>,
  n: number,
  placed: Placement[],
  o: {
    height: number;
    alpha: number;
    kind: Kind;
    title?: Channel<R> | undefined;
    ariaLabel?: string | undefined;
  },
): Plot.Markish {
  const x: (Value | null)[] = new Array(n).fill(null);
  const y: (Value | null)[] = new Array(n).fill(null);
  const src: (string | null)[] = new Array(n).fill(null);
  for (const p of placed) {
    x[p.index] = p.x;
    y[p.index] = p.y;
    src[p.index] = p.url;
  }
  return Plot.image(data as Plot.Data, {
    x: x as Plot.ChannelValue,
    y: y as Plot.ChannelValue,
    src: src as Plot.ChannelValue,
    opacity: o.alpha,
    ...(o.title === undefined ? {} : { title: o.title as Plot.ChannelValue }),
    ariaLabel: o.ariaLabel ?? `sdv-${o.kind}s`,
    render: sizeRender(o.height, placed, o.kind),
  });
}

function build<R>(data: Data<R>, o: MarkOptions<R>, kind: "logo" | "wordmark"): Plot.Markish {
  const height = checkHeight(o.height ?? 0.1);
  const alpha = checkAlpha(o.alpha ?? 1);
  const xs = values(data, o.x);
  const ys = values(data, o.y);
  const teams = values(data, o.team);
  const season =
    o.season === undefined || typeof o.season === "number" || typeof o.season === "string"
      ? (o.season as SeasonInput)
      : (values(data, o.season as Channel<R>) as readonly SeasonInput[]);
  const placed = placeSync(xs, ys, teams, {
    league: o.league,
    kind,
    variant: o.variant ?? "default",
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
    ...(season === undefined ? {} : { season }),
  });
  return imageMark(data, xs.length, placed, { height, alpha, kind, title: o.title, ariaLabel: o.ariaLabel });
}
export function logos<R>(data: Data<R>, o: MarkOptions<R>): Plot.Markish {
  return build(data, o, "logo");
}
export function wordmarks<R>(data: Data<R>, o: MarkOptions<R>): Plot.Markish {
  return build(data, o, "wordmark");
}
export function headshots<R>(data: Data<R>, o: HeadshotOptions<R>): Plot.Markish {
  const height = checkHeight(o.height ?? 0.1);
  const alpha = checkAlpha(o.alpha ?? 1);
  const xs = values(data, o.x);
  const ys = values(data, o.y);
  const ids = values(data, o.player);
  const placed = placeSync(xs, ys, ids, {
    league: o.league,
    kind: "headshot",
    idSystem: o.idSystem ?? "espn",
  });
  return imageMark(data, xs.length, placed, {
    height,
    alpha,
    kind: "headshot",
    title: o.title,
    ariaLabel: o.ariaLabel,
  });
}
