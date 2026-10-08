import { appendSurface as sportyAppendSurface } from "@sportsdataverse/sporty/d3";
import { type ScaleOrdinal, type Selection, scaleOrdinal } from "d3";
import { InputError } from "../errors.js";
import type { EspnHeadshotLeague } from "../headshots.js";
import { type Kind, checkAlpha, checkHeight, placeSync } from "../placement.js";
import type { Value } from "../resolve.js";
import { stampImage } from "../stamp.js";
import { type SurfaceSceneOptions, surfaceScene } from "../surfaces.js";
import { teamColorDomain } from "../team-color-domain.js";
import type { HeadshotIdSystem, IdSystem, League, SeasonInput, Variant, Which } from "../types.js";

type Sel<G extends Element> = Selection<G, unknown, null, undefined>;
/** Where d3 draws: the caller's scales, plus the pixel height the `height` fraction refers to (d3 has no figure). */
interface Frame {
  x: (v: Value) => number;
  y: (v: Value) => number;
  frameHeight: number;
  height?: number;
  alpha?: number;
}
export interface D3MarkOptions extends Frame {
  league: League;
  season?: SeasonInput | readonly SeasonInput[];
  variant?: Variant;
  idSystem?: IdSystem;
}
export interface D3HeadshotOptions extends Frame {
  league: EspnHeadshotLeague;
  /** "espn" (default) or "gsis". "gsis" needs `loadGsis()` to have run first, else this throws InputError. */
  idSystem?: HeadshotIdSystem;
}

function draw<G extends SVGElement>(
  sel: Sel<G>,
  xs: ArrayLike<Value>,
  ys: ArrayLike<Value>,
  ids: readonly Value[],
  o: Frame,
  kind: Kind,
  place: Parameters<typeof placeSync>[3],
): Sel<SVGGElement> {
  const h = checkHeight(o.height ?? 0.1);
  const alpha = checkAlpha(o.alpha ?? 1);
  if (!(Number.isFinite(o.frameHeight) && o.frameHeight > 0)) {
    throw new InputError(`frameHeight is the plot height in px, got ${String(o.frameHeight)}`);
  }
  const px = h * o.frameHeight;
  const placed = placeSync(Array.from(xs), Array.from(ys), ids, place);
  const g = sel.append("g").attr("class", `sdv-${kind}s`).attr("opacity", alpha);
  for (const p of placed) {
    const img = g.append("image").attr("href", p.url).attr("preserveAspectRatio", "xMidYMid meet");
    const node = img.node();
    if (node === null) continue;
    stampImage(node, p, kind, px, o.frameHeight, o.x(p.x), o.y(p.y));
    img.attr("data-sdv-x", String(p.x)).attr("data-sdv-y", String(p.y));
  }
  return g;
}
export type AppendTeamMarks = <G extends SVGElement>(
  sel: Sel<G>,
  xs: ArrayLike<Value>,
  ys: ArrayLike<Value>,
  teams: readonly Value[],
  o: D3MarkOptions,
) => Sel<SVGGElement>;
const teamMark =
  (kind: "logo" | "wordmark"): AppendTeamMarks =>
  (sel, xs, ys, teams, o) =>
    draw(sel, xs, ys, teams, o, kind, {
      league: o.league,
      kind,
      variant: o.variant ?? "default",
      ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
      ...(o.season === undefined ? {} : { season: o.season }),
    });
/** Append `<g class="sdv-logos">` of team logos at (x, y) through the caller's scale functions. Needs `loadLeague(league)` first. */
export const appendLogos: AppendTeamMarks = teamMark("logo");
/** As `appendLogos`, with wordmarks. */
export const appendWordmarks: AppendTeamMarks = teamMark("wordmark");
/** Append `<g class="sdv-headshots">` of ESPN player headshots; `idSystem: "gsis"` needs `loadGsis()` first. */
export function appendHeadshots<G extends SVGElement>(
  sel: Sel<G>,
  xs: ArrayLike<Value>,
  ys: ArrayLike<Value>,
  players: readonly Value[],
  o: D3HeadshotOptions,
): Sel<SVGGElement> {
  return draw(sel, xs, ys, players, o, "headshot", {
    league: o.league,
    kind: "headshot",
    idSystem: o.idSystem ?? "espn",
  });
}

/** A d3 ordinal scale from team (id or abbr) to team colour; anything unresolved maps to `naValue` (default "grey"). */
export function teamColorScale(
  league: League,
  o: {
    which?: Which;
    season?: SeasonInput;
    idSystem?: IdSystem;
    naValue?: string;
    values?: readonly Value[];
  } = {},
): ScaleOrdinal<string, string, string> {
  const na = o.naValue ?? "grey";
  const { domain, colors } = teamColorDomain(league, o);
  return scaleOrdinal<string, string>()
    .domain(domain)
    .range(colors.map((c) => c ?? na))
    .unknown(na);
}

export interface D3SurfaceOptions extends SurfaceSceneOptions {
  x: (v: number) => number;
  y: (v: number) => number;
}
/** Paint a league's surface (in `team`'s colours) into `sel` through the caller's x/y scales. Throws InputError for a league with no surface. */
export function appendSurface<G extends SVGGElement | SVGSVGElement>(
  sel: Sel<G>,
  league: League,
  o: D3SurfaceOptions,
): Sel<SVGGElement> {
  const { x, y, ...scene } = o;
  return sportyAppendSurface(sel, surfaceScene(league, scene), x, y);
}
export { appendLegend, appendSignature } from "./shots.js";
export type { AppendLegendOptions, AppendSignatureOptions } from "./shots.js";
