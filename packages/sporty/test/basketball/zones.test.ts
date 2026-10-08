import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  BASKETBALL_ZONES,
  type BasketballZone,
  FRAMES,
  UnknownLeagueError,
  basketballZoneOf,
  basketballZones,
  toSurfaceFrame,
} from "../../src/index.js";

const shots = join(fileURLToPath(import.meta.url), "../../../../../fixtures/shots");
const cols = JSON.parse(readFileSync(join(shots, "nba-2026-bkn-2000-columns.json"), "utf8")) as Record<
  string,
  number[]
>;
const oracle = JSON.parse(readFileSync(join(shots, "oracle.json"), "utf8")) as { main: { zoneOf: string } };

/** Winding number of `p` around a closed ring (nonzero rule). */
function winding(ring: readonly (readonly [number, number])[], [px, py]: readonly [number, number]): number {
  let w = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i] as readonly [number, number];
    const [x2, y2] = ring[(i + 1) % ring.length] as readonly [number, number];
    const cross = (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1);
    if (y1 <= py && y2 > py && cross > 0) w += 1;
    else if (y1 > py && y2 <= py && cross < 0) w -= 1;
  }
  return w;
}

test("zoneOf: the 2000 real BKN shots land in blazing-the-nets main's zones (legacy tenths, scale 10)", () => {
  const x = cols.x_legacy ?? [];
  const got = x.map((_, i) =>
    BASKETBALL_ZONES.indexOf(
      basketballZoneOf(x[i] ?? 0, cols.y_legacy?.[i] ?? 0, cols.shot_value?.[i] ?? 0, { scale: 10 }),
    ),
  );
  expect(got.join("")).toBe(oracle.main.zoneOf);
});
test("geometry comes from the NBA spec: corner break at sqrt(23.75^2 - 22^2) ft, 4 ft restricted arc, 16 ft lane to 13.75 ft", () => {
  const b = Math.sqrt(23.75 ** 2 - 22 ** 2);
  expect(basketballZoneOf(-22.5, b, 3)).toBe("corner_3_left");
  expect(basketballZoneOf(22.5, b + 1e-9, 3)).toBe("above_break_3");
  expect(basketballZoneOf(0, 4, 2)).toBe("restricted_area");
  expect(basketballZoneOf(8, 13.75, 2)).toBe("paint");
  expect(basketballZoneOf(8.01, 13.75, 2)).toBe("mid_range");
  expect(() => basketballZoneOf(0, 0, 2, { league: "abl" })).toThrow(UnknownLeagueError);
});
test("the six areas tile the half court: every grid point is in exactly one ring, in the zone zoneOf gives it", () => {
  const areas = basketballZones("nba", { top: 41.75 });
  let n = 0;
  // A 0.71 ft grid offset from every zone line (a point ON the restricted arc is either side of a 200-gon).
  for (let x = -24.93; x < 25; x += 0.71) {
    for (let y = -5.17; y < 41.7; y += 0.71) {
      const inside = areas.filter((a) => winding(a.points, [x, y]) !== 0).map((a) => a.zone);
      expect(inside).toHaveLength(1);
      const three = Math.hypot(x, y) > 23.75 || (Math.abs(x) > 22 && y <= Math.sqrt(23.75 ** 2 - 22 ** 2));
      expect(inside[0]).toBe(basketballZoneOf(x, y, three ? 3 : 2) satisfies BasketballZone);
      n += 1;
    }
  }
  expect(n).toBeGreaterThan(4500);
});
test("nba-legacy-vertical puts the hoop at (0, -41.75) and keeps legacy x's sign", () => {
  const [p] = toSurfaceFrame([{ x_legacy: -100, y_legacy: 0 }], { from: "nba-legacy-vertical" });
  expect([p?.surface_x, p?.surface_y]).toEqual([-10, -41.75]);
  expect(FRAMES["nba-legacy-vertical"].description).toMatch(/bottom/);
});
test("labels come from the league's own lines: every fiba (metres) label is on the court and in its own zone", () => {
  const areas = basketballZones("fiba");
  expect(areas).toHaveLength(6);
  for (const a of areas) {
    const [x, y] = a.label;
    expect(Math.abs(x)).toBeLessThanOrEqual(7.5); // court_width / 2
    expect(y).toBeGreaterThanOrEqual(-1.575); // the baseline
    expect(y).toBeLessThanOrEqual(14 - 1.575); // the half-court line
    expect(winding(a.points, a.label)).not.toBe(0);
  }
});
