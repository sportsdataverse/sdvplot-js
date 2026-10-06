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
  /** A team logo at the surface centre: `true` is 0.25 of the frame height, a number is that fraction in (0, 1]. */
  centerLogo?: boolean | number;
}

/**
 * Plot marks + scales for a team-painted sporty surface. Only an unsupported league throws `InputError`; sporty's own
 * errors (`SportyError` subclasses: unknown displayRange/unit, bad arcResolution) propagate unwrapped.
 */
export function surface(
  league: League,
  o: SurfaceOpts = {},
): { marks: Plot.Markish[]; scales: ReturnType<typeof surfaceScales>; scene: Scene } {
  const { centerLogo, ...opts } = o;
  const scene = surfaceScene(league, opts);
  const marks = surfaceMark(scene);
  const { team, season } = o;
  if (centerLogo && team !== undefined && team !== null) {
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
