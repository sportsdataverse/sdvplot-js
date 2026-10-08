import type * as Plot from "@observablehq/plot";
import type { Scene } from "@sportsdataverse/sporty";
import { surfaceMark, surfaceScales } from "@sportsdataverse/sporty/plot";
import { checkHeight } from "../placement.js";
import { type SurfaceSceneOptions, surfaceScene } from "../surfaces.js";
import type { League } from "../types.js";
import { logos } from "./marks.js";

export { SURFACES, SURFACE_BASE, colorUpdates } from "../surfaces.js";

/** Sporty's surface options plus `team` painting; `colorUpdates` overrides are keyed by sporty colour keys. */
export interface SurfaceOpts extends SurfaceSceneOptions {
  /**
   * A team logo at the surface centre (0, 0): `true` is 0.25 of the frame height, a number is that fraction in (0, 1] (0 or
   * out of range throws InputError). Ignored without a `team`. xTrans/yTrans or a half-court displayRange can move (0, 0) off-frame.
   */
  centerLogo?: boolean | number;
}

/**
 * Plot marks + scales for a team-painted sporty surface. Only an unsupported league throws `InputError`; sporty's own
 * errors (`SportyError` subclasses: unknown displayRange/unit, bad arcResolution) propagate unwrapped.
 *
 * @example
 * ```ts
 * import * as Plot from "@observablehq/plot";
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { surface } from "@sportsdataverse/sdvplot/plot";
 *
 * await loadLeague("nhl");
 * // arcResolution: points per arc (default 200); 24 is plenty at 480 px and keeps the SVG small
 * const rink = surface("nhl", { team: "BOS", displayRange: "offense", arcResolution: 24 });
 * Plot.plot({ ...rink.scales, width: 480, marks: rink.marks });
 * ```
 */
export function surface(
  league: League,
  o: SurfaceOpts = {},
): { marks: Plot.Markish[]; scales: ReturnType<typeof surfaceScales>; scene: Scene } {
  const { centerLogo, ...opts } = o;
  const scene = surfaceScene(league, opts);
  const marks = surfaceMark(scene);
  const { team, season } = o;
  if (centerLogo !== undefined && centerLogo !== false && team !== undefined && team !== null) {
    const height = centerLogo === true ? 0.25 : checkHeight(centerLogo);
    marks.push(
      logos([{ x: 0, y: 0, team }], {
        league,
        x: "x",
        y: "y",
        team: "team",
        height,
        ...(season !== undefined ? { season } : {}),
      }),
    );
  }
  return { marks, scales: surfaceScales(scene), scene };
}
