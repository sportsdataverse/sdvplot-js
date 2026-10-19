import { InputError } from "../errors.js";

/**
 * The Baseball Savant (Statcast) pitch fields `statcastPitchPath` reads, by their Savant CSV column names: feet, feet
 * per second and feet per second squared, in Statcast's frame (catcher's view: x to the catcher's right, the
 * first-base side; y from the point of home plate towards the mound; z up).
 */
export interface StatcastPitch {
  /** Velocity at y = 50 ft, ft/s. */
  vx0: number;
  vy0: number;
  vz0: number;
  /** Acceleration (constant over the flight), ft/s². */
  ax: number;
  ay: number;
  az: number;
  /**
   * Where the pitch crossed home plate, ft: at its front edge (y = 17/12 ft) through 2025, and at its middle
   * (y = 8.5/12 ft, "to align with the ABS system") from 2026, per Savant's CSV documentation.
   */
  plate_x: number;
  plate_z: number;
  /** The release point's distance from home plate, ft (60.5 less the pitcher's extension). */
  release_pos_y: number;
  /** The season: it says which plate plane plate_x and plate_z are at (see `StatcastPathOptions.plate`). */
  game_year?: number;
}
/** `statcastPitchPath` options. */
export interface StatcastPathOptions {
  /** Steps from release to the plate, equal in time: the path has `steps + 1` points. Default 40. */
  steps?: number;
  /**
   * The plane plate_x and plate_z were measured at: "front" (the plate's front edge, Savant through 2025) or "middle"
   * (halfway along it, from 2026). Default: from the pitch's `game_year`; with neither it is an InputError, as a wrong
   * plane moves the whole path 8.5 inches along its flight.
   */
  plate?: "front" | "middle";
}

const FIELDS = ["vx0", "vy0", "vz0", "ax", "ay", "az", "plate_x", "plate_z", "release_pos_y"] as const;
/** Where Statcast reports plate_x and plate_z, ft from home plate's point: its front edge, or halfway to it. */
const PLATE_Y = { front: 17 / 12, middle: 8.5 / 12 } as const;
/** The plane Statcast's velocities (vx0, vy0, vz0) are measured at, ft from home plate. */
const Y0 = 50;

/**
 * A pitch's flight from release to the front of home plate, as `[x, y, z]` points in feet in Statcast's frame, which
 * is sporty's baseball frame too (home plate's point at the origin, y towards the mound), so the path draws over
 * `surfaceMesh("baseball", "mlb")` unconverted. Statcast describes each pitch with the PITCHf/x nine-parameter fit:
 * constant acceleration (ax, ay, az) and the velocity (vx0, vy0, vz0) at y = 50 ft, so
 * `p(t) = p50 + v0 t + a t² / 2` (Baseball Savant CSV documentation, https://baseballsavant.mlb.com/csv-docs: "vx0,
 * vy0, vz0: the velocity of the pitch, in feet per second, in x, y, and z dimensions, determined at y=50 feet"; "ax,
 * ay, az: the acceleration of the pitch, in feet per second per second ... determined at y=50 feet"; A. M. Nathan,
 * "Determining Pitch Movement from PITCHf/x Data", 2012, https://baseball.physics.illinois.edu/Movement.pdf). Savant's
 * CSV leaves out x and z at y = 50, so they are solved from where the fit crosses the plate (plate_x, plate_z: at its
 * front edge, y = 17/12 ft, through 2025; at its middle, y = 8.5/12 ft, from 2026, per the same documentation); the
 * path then runs, equal steps in time, from y = release_pos_y to that plane. Traced back to the release, it lands on
 * Savant's own release_pos_x / release_pos_z within their 0.01 ft rounding (checked on 2024 and 2026 pitches).
 *
 * @example
 * ```ts
 * import { statcastPitchPath } from "@sportsdataverse/sdvplot/three";
 *
 * // a 96.3 mph four-seamer, Yankees at Red Sox, 2024-06-15 (Baseball Savant: game 746946, at-bat 48, pitch 4)
 * const pitch = {
 *   vx0: -6.245145230392043, vy0: -140.0548111003631, vz0: -4.647911601289857,
 *   ax: 12.681580763686934, ay: 32.15363682007945, az: -12.428443024407864,
 *   plate_x: 0.42927397039380755, plate_z: 3.546869816011372, release_pos_y: 54.12, game_year: 2024,
 * };
 * const path = statcastPitchPath(pitch); // 41 points, release to plate
 * path[0]; // about [2.05, 54.12, 6.17]: Savant's release_pos_x, release_pos_y, release_pos_z
 * ```
 */
export function statcastPitchPath(
  pitch: StatcastPitch,
  o: StatcastPathOptions = {},
): [x: number, y: number, z: number][] {
  for (const k of FIELDS)
    if (!Number.isFinite(pitch[k]))
      throw new InputError(`statcastPitchPath needs a number in the pitch's ${k} (a Baseball Savant column)`);
  const steps = o.steps ?? 40;
  if (!(Number.isInteger(steps) && steps >= 1))
    throw new InputError(`steps is a whole number, 1 or more, got ${String(steps)}`);
  const year = pitch.game_year;
  const plate =
    o.plate ?? (Number.isFinite(year) ? ((year as number) >= 2026 ? "middle" : "front") : undefined);
  if (plate !== "front" && plate !== "middle")
    throw new InputError(
      'statcastPitchPath needs the pitch\'s game_year, or plate: "front" (through 2025) or "middle" (from 2026), ' +
        "to know where plate_x and plate_z were measured",
    );
  const { vx0, vy0, vz0, ax, ay, az, plate_x, plate_z, release_pos_y } = pitch;
  // the time (from y = 50 ft) at which y(t) = 50 + vy0 t + ay t^2 / 2 reaches y: the root nearer 0, written so it stays
  // accurate however small ay is
  const when = (y: number): number => {
    const c = Y0 - y;
    const d = vy0 * vy0 - 2 * ay * c;
    if (!(vy0 < 0 && d >= 0))
      throw new InputError(`the pitch never reaches y = ${y} ft (vy0 ${vy0}, ay ${ay})`);
    return (2 * c) / (-vy0 + Math.sqrt(d));
  };
  const tp = when(PLATE_Y[plate]);
  const tr = when(release_pos_y);
  const x50 = plate_x - vx0 * tp - (ax * tp * tp) / 2;
  const z50 = plate_z - vz0 * tp - (az * tp * tp) / 2;
  const at = (t: number): [number, number, number] => [
    x50 + vx0 * t + (ax * t * t) / 2,
    Y0 + vy0 * t + (ay * t * t) / 2,
    z50 + vz0 * t + (az * t * t) / 2,
  ];
  const path = Array.from({ length: steps + 1 }, (_, i) => at(tr + ((tp - tr) * i) / steps));
  path[steps] = [plate_x, PLATE_Y[plate], plate_z]; // the measured crossing itself, free of rounding
  return path;
}
