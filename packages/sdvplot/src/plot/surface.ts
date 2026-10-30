import type * as Plot from "@observablehq/plot";
import type { Scene } from "@sportsdataverse/sporty";
import { surfaceMark, surfaceScales } from "@sportsdataverse/sporty/plot";
import { checkHeight } from "../placement.js";
import { type SurfaceSceneOptions, centerLogoPlacement, surfaceScene } from "../surfaces.js";
import type { League } from "../types.js";
import { logos } from "./marks.js";

export { SURFACES, SURFACE_BASE, colorUpdates } from "../surfaces.js";

/** Sporty's surface options plus `team` painting; `colorUpdates` overrides are keyed by sporty colour keys. */
export interface SurfaceOpts extends SurfaceSceneOptions {
  /**
   * The team's logo at the surface centre, moved with `xTrans` / `yTrans` and `rotation` as the surface is: `true` is 0.25
   * of the frame height, a number is that fraction in (0, 1] (0 or out of range throws InputError). A baseball or softball
   * field's origin is home plate, so there the logo goes in shallow centre field, as in sdvplotR and sdvplot: at x = 0,
   * midway between second base (`baseline_distance * sqrt(2)`) and the centre-field fence, and with `true` 0.15 x
   * `center_field_distance` across (60 ft on an MLB field, at 263.6 ft from home plate). On grass (football, soccer,
   * baseball, softball) it is the team's dark-background logo. Ignored without a `team` (sdvplotR errors instead). A
   * half-surface displayRange can leave the logo off-frame.
   */
  centerLogo?: boolean | number;
}

/**
 * Plot marks + scales for a team-painted sporty surface, for any key of `SURFACES`. An unsupported key, or a `team` on a key
 * without team identities, throws `InputError`; sporty's own
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
  league: League | (string & {}),
  o: SurfaceOpts = {},
): { marks: Plot.Markish[]; scales: ReturnType<typeof surfaceScales>; scene: Scene } {
  const { centerLogo, ...opts } = o;
  const scene = surfaceScene(league, opts);
  const marks = surfaceMark(scene);
  const { team, season } = o;
  if (centerLogo !== undefined && centerLogo !== false && team !== undefined && team !== null) {
    const at = centerLogoPlacement(league, opts);
    const [, y0, , y1] = scene.bbox;
    const height =
      centerLogo !== true
        ? checkHeight(centerLogo)
        : at.size === undefined
          ? 0.25
          : Math.min(at.size / (y1 - y0), 1);
    marks.push(
      logos([{ x: at.x, y: at.y, team }], {
        league: league as League, // surfaceScene threw already if a team was passed for a key without team identities
        x: "x",
        y: "y",
        team: "team",
        height,
        variant: at.variant,
        ...(season !== undefined ? { season } : {}),
      }),
    );
  }
  return { marks, scales: surfaceScales(scene), scene };
}
