import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { surface } from "@sportsdataverse/sporty";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { contrast } from "../src/contrast.js";
import { InputError } from "../src/errors.js";
import { getLeagueSync } from "../src/index-data.js";
import { resetWarnings, setWarningHandler, teamColorsSync } from "../src/index.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE } from "../src/team-palette.js";
import {
  type StatcastPitch,
  type SurfaceMesh,
  statcastPitchPath,
  surfaceMesh,
  teamColorPalette,
  trajectoryTube,
} from "../src/three/index.js";
import "./_fixtures.js"; // preloads every league

beforeEach(() => resetWarnings());

const HERE = dirname(fileURLToPath(import.meta.url));
const SAVANT = resolve(HERE, "../../../fixtures/examples/mlb_statcast_search_2024-06-15_head.csv");
const SAVANT_2026 = resolve(HERE, "../../../fixtures/examples/mlb_statcast_search_2026-06-15_head.csv");

/** Baseball Savant's CSV (quoted fields, a BOM) as rows of strings. */
function savant(file = SAVANT): Record<string, string>[] {
  const text = readFileSync(file, "utf8").replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  const [head = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(r.map((v, i) => [head[i], v])));
}
const NUM = [
  "vx0",
  "vy0",
  "vz0",
  "ax",
  "ay",
  "az",
  "plate_x",
  "plate_z",
  "release_pos_y",
  "game_year",
] as const;
const pitch = (r: Record<string, string>): StatcastPitch =>
  Object.fromEntries(NUM.map((k) => [k, Number(r[k])])) as unknown as StatcastPitch;
const warnings = (fn: () => void): string[] => {
  const spy = vi.fn();
  setWarningHandler(spy);
  try {
    fn();
  } finally {
    setWarningHandler(null);
  }
  return spy.mock.calls.map((c) => String(c[0]));
};
type P3 = readonly [number, number, number];
const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: P3, b: P3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: P3): number => Math.sqrt(dot(a, a));
const at = (buf: Float32Array, i: number): P3 => [
  buf[3 * i] as number,
  buf[3 * i + 1] as number,
  buf[3 * i + 2] as number,
];

describe("statcastPitchPath: Statcast's constant-acceleration (nine-parameter) pitch model", () => {
  const rows = savant();

  test("the fixture is the sportsdataverse-py capture, byte for byte: 46 real pitches of 2024-06-15", () => {
    const sha = createHash("sha256").update(readFileSync(SAVANT)).digest("hex");
    expect(sha).toBe("f605ab3da13670a78f53286484758505a4fe78d95a9730bce4a8de8d94248608");
    expect(rows).toHaveLength(46);
    expect(Object.keys(rows[0] as object)).toHaveLength(119);
  });

  test("each path ends where Savant measured the pitch crossing the front of home plate (y = 17/12 ft)", () => {
    for (const r of rows) {
      const path = statcastPitchPath(pitch(r));
      const [x, y, z] = path[path.length - 1] as P3;
      expect(y).toBeCloseTo(17 / 12, 9);
      expect(x).toBeCloseTo(Number(r.plate_x), 9);
      expect(z).toBeCloseTo(Number(r.plate_z), 9);
    }
  });

  test("traced back to Savant's release extension, the model lands on Savant's own release point (within 0.01 ft)", () => {
    // release_pos_x / release_pos_z are measured, not fed in: the model reproducing them is the check on the formula,
    // its y = 50 ft reference plane and the plate's y. Savant rounds them to 0.01 ft.
    for (const r of rows) {
      const [x, y, z] = statcastPitchPath(pitch(r))[0] as P3;
      expect(y).toBeCloseTo(Number(r.release_pos_y), 9);
      expect(
        Math.abs(x - Number(r.release_pos_x)),
        `${r.game_pk}/${r.at_bat_number}/${r.pitch_number} x`,
      ).toBeLessThan(0.01);
      expect(
        Math.abs(z - Number(r.release_pos_z)),
        `${r.game_pk}/${r.at_bat_number}/${r.pitch_number} z`,
      ).toBeLessThan(0.01);
    }
  });

  test("from 2026 Savant measures plate_x and plate_z at the middle of the plate (y = 8.5/12 ft), and the path follows", () => {
    const sha = createHash("sha256").update(readFileSync(SAVANT_2026)).digest("hex");
    expect(sha).toBe("df1e2f7fa36a18c79c87efaf0a28697cfe112aa52c47f9389107c8efe340c56d");
    const late = savant(SAVANT_2026);
    expect(late).toHaveLength(5);
    for (const r of late) {
      expect(r.game_year).toBe("2026");
      const path = statcastPitchPath(pitch(r));
      expect((path[path.length - 1] as P3)[1]).toBeCloseTo(8.5 / 12, 9);
      const [x, , z] = path[0] as P3;
      expect(Math.abs(x - Number(r.release_pos_x))).toBeLessThan(0.01);
      expect(Math.abs(z - Number(r.release_pos_z))).toBeLessThan(0.01);
      // the front-of-plate plane misses Savant's release point on these pitches: the plane matters
      const [xf, , zf] = statcastPitchPath(pitch(r), { plate: "front" })[0] as P3;
      expect(
        Math.max(Math.abs(xf - Number(r.release_pos_x)), Math.abs(zf - Number(r.release_pos_z))),
      ).toBeGreaterThan(0.02);
    }
  });

  test("with no game_year the plate plane must be given", () => {
    const { game_year: _, ...p } = pitch(rows[0] as Record<string, string>);
    expect(() => statcastPitchPath(p)).toThrow(/game_year/);
    expect(statcastPitchPath(p, { plate: "front" })).toEqual(
      statcastPitchPath(pitch(rows[0] as Record<string, string>)),
    );
  });

  test("the speed out of the hand is Savant's release_speed (within 0.25 mph), from two points a step apart", () => {
    for (const r of rows) {
      const path = statcastPitchPath(pitch(r), { steps: 2000 });
      const [a, b] = path as unknown as [P3, P3];
      // the step's duration: y(t) = 50 + vy0 t + ay t^2 / 2 between the two points, solved for dt at the release end
      const p = pitch(r);
      const t = (y: number): number => {
        const c = 50 - y;
        return (2 * c) / (-p.vy0 + Math.sqrt(p.vy0 * p.vy0 - 2 * p.ay * c));
      };
      const mph = (norm(sub(b, a)) / (t(b[1]) - t(a[1]))) * (3600 / 5280);
      expect(Math.abs(mph - Number(r.release_speed))).toBeLessThan(0.25);
    }
  });

  test("steps + 1 points, y falling all the way to the plate; a missing or non-numeric field is an InputError", () => {
    const p = pitch(rows[0] as Record<string, string>);
    const path = statcastPitchPath(p, { steps: 10 });
    expect(path).toHaveLength(11);
    for (let i = 1; i < path.length; i++) expect((path[i] as P3)[1]).toBeLessThan((path[i - 1] as P3)[1]);
    expect(() => statcastPitchPath({ ...p, vy0: Number.NaN })).toThrow(/vy0/);
    const { az: _, ...noAz } = p;
    expect(() => statcastPitchPath(noAz as StatcastPitch)).toThrow(InputError);
    expect(() => statcastPitchPath(p, { steps: 0 })).toThrow(InputError);
  });
});

describe("trajectoryTube: a tube along a 3D polyline, in world units", () => {
  const rows = savant();
  const path = statcastPitchPath(pitch(rows[0] as Record<string, string>), { steps: 20 });
  const R = 0.121; // a baseball's radius in feet (9 to 9.25 in around)

  test("rings of radialSegments vertices round each point, every one exactly radius from it, across the path", () => {
    const tube = trajectoryTube(path, { radius: R, color: "#003087", radialSegments: 12 });
    expect(tube.positions.length / 3).toBe(path.length * 12);
    expect(tube.indices.length).toBe((path.length - 1) * 12 * 6);
    for (let k = 0; k < path.length; k++) {
      const c = path[k] as P3;
      const tangent = sub(path[Math.min(k + 1, path.length - 1)] as P3, path[Math.max(k - 1, 0)] as P3);
      for (let j = 0; j < 12; j++) {
        const v = sub(at(tube.positions, k * 12 + j), c);
        expect(norm(v)).toBeCloseTo(R, 5);
        expect(Math.abs(dot(v, tangent)) / (norm(v) * norm(tangent))).toBeLessThan(0.05); // across, not along
        expect(norm(at(tube.normals, k * 12 + j))).toBeCloseTo(1, 5);
      }
    }
  });

  test("the tube starts and ends at the path's ends (the ring centres), and its length is the path's", () => {
    const tube = trajectoryTube(path, { radius: R, color: "#003087", radialSegments: 8 });
    const centre = (ring: number): P3 => {
      const v = Array.from({ length: 8 }, (_, j) => at(tube.positions, ring * 8 + j));
      return [0, 1, 2].map((d) => v.reduce((s, p) => s + (p[d] as number), 0) / 8) as unknown as P3;
    };
    for (const [ring, p] of [
      [0, path[0]],
      [path.length - 1, path[path.length - 1]],
    ] as const)
      for (let d = 0; d < 3; d++) expect(centre(ring)[d]).toBeCloseTo((p as P3)[d] as number, 4);
    let len = 0;
    for (let i = 1; i < path.length; i++) len += norm(sub(path[i] as P3, path[i - 1] as P3));
    expect(tube.length).toBeCloseTo(len, 9);
    expect(tube.radius).toBe(R);
  });

  test("team-coloured: the team's primary (or secondary), and with a background one that reads at 3:1", () => {
    const [nyy] = teamColorsSync("mlb", ["NYY"]);
    expect(trajectoryTube(path, { radius: R, team: "NYY", league: "mlb" }).color).toBe(nyy);
    const [alt] = teamColorsSync("mlb", ["NYY"], { which: "secondary" });
    expect(trajectoryTube(path, { radius: R, team: "NYY", league: "mlb", which: "secondary" }).color).toBe(
      alt,
    );
    const bg = "#395d33"; // sporty's baseball grass
    expect(contrast(nyy as string, bg)).toBeLessThan(MIN_CONTRAST); // navy on grass does not read
    const dark = trajectoryTube(path, { radius: R, team: "NYY", league: "mlb", background: bg }).color;
    expect(contrast(dark, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(trajectoryTube(path, { radius: R, color: "#123456" }).color).toBe("#123456");
    expect(trajectoryTube(path, { radius: R, team: "XXX", league: "mlb" }).color).toBe("#808080");
  });

  test("units: radius is in the points' world units; a px size, a missing or bad radius, or two colours is an InputError", () => {
    expect(() => trajectoryTube(path, { color: "#000000" } as never)).toThrow(/radius/);
    for (const radius of [0, -1, Number.NaN])
      expect(() => trajectoryTube(path, { radius, color: "#000000" })).toThrow(InputError);
    for (const key of ["width", "size", "lineWidth"])
      expect(() => trajectoryTube(path, { radius: R, color: "#000000", [key]: 4 } as never)).toThrow(
        /world units/,
      );
    expect(() => trajectoryTube(path, { radius: R, color: "#000000", team: "NYY", league: "mlb" })).toThrow(
      /color or team/,
    );
    expect(() => trajectoryTube(path, { radius: R })).toThrow(/color or team/);
    expect(() => trajectoryTube([path[0] as P3], { radius: R, color: "#000000" })).toThrow(/two/);
    expect(() =>
      trajectoryTube([path[0] as P3, [0, Number.NaN, 0]], { radius: R, color: "#000000" }),
    ).toThrow(InputError);
    expect(() => trajectoryTube(path, { radius: R, color: "#000000", radialSegments: 2 })).toThrow(
      /radialSegments/,
    );
  });

  test("every triangle faces out of the tube (counter-clockwise seen from outside), so FrontSide draws it", () => {
    const tube = trajectoryTube(path, { radius: R, color: "#003087", radialSegments: 8 });
    for (let t = 0; t < tube.indices.length / 3; t++) {
      const [a, b, c] = [0, 1, 2].map((k) => at(tube.positions, tube.indices[3 * t + k] as number)) as [
        P3,
        P3,
        P3,
      ];
      const [u, v] = [sub(b, a), sub(c, a)];
      const n: P3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const ring = Math.floor((tube.indices[3 * t] as number) / 8);
      expect(dot(n, sub(a, path[ring] as P3)), `triangle ${t}`).toBeGreaterThan(0);
    }
  });

  test("a repeated point is skipped (no zero-length step to orient a ring on)", () => {
    const twice = [path[0] as P3, path[0] as P3, ...path.slice(1)];
    expect(trajectoryTube(twice, { radius: R, color: "#000000", radialSegments: 8 }).positions.length).toBe(
      path.length * 8 * 3,
    );
  });
});

const SPORTS = [
  ["baseball", "mlb"],
  ["basketball", "nba"],
  ["curling", "wcf"],
  ["football", "nfl"],
  ["hockey", "nhl"],
  ["lacrosse", "nll"],
  ["soccer", "fifa"],
  ["tennis", "atp"],
  ["volleyball", "fivb"],
] as const;
/** Twice the signed area of a triangle in the z = 0 plane: positive when counter-clockwise seen from +z. */
const tri2 = (m: SurfaceMesh, t: number): number => {
  const [a, b, c] = [0, 1, 2].map((k) => at(m.positions, m.indices[3 * t + k] as number));
  return (
    ((b as P3)[0] - (a as P3)[0]) * ((c as P3)[1] - (a as P3)[1]) -
    ((c as P3)[0] - (a as P3)[0]) * ((b as P3)[1] - (a as P3)[1])
  );
};
const loopArea = (m: SurfaceMesh, l: SurfaceMesh["loops"][number]): number => {
  let s = 0;
  for (let i = 0; i < l.vertexCount; i++) {
    const a = at(m.positions, l.vertexStart + i);
    const b = at(m.positions, l.vertexStart + ((i + 1) % l.vertexCount));
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
};

describe("surfaceMesh: sporty's surface as one triangle mesh in the z = 0 plane", () => {
  test.each(SPORTS)(
    "%s %s: every loop is filled exactly (triangle area = loop area), face up, flat at z = 0",
    (sport, league) => {
      const m = surfaceMesh(sport, league);
      const scene = surface(sport, league);
      expect(m.units).toBe(scene.units);
      expect(m.bbox).toEqual(scene.bbox);
      for (let i = 2; i < m.positions.length; i += 3) expect(m.positions[i]).toBe(0);
      expect(m.colors.length / 4).toBe(m.positions.length / 3);
      let indexEnd = 0;
      for (const l of m.loops) {
        expect(l.indexStart).toBe(indexEnd); // the loops are in order, back to front
        indexEnd += l.indexCount;
        expect(l.indexCount / 3, `${l.name}: a loop of n points is n - 2 triangles`).toBe(l.vertexCount - 2);
        let filled = 0;
        for (let t = l.indexStart / 3; t < (l.indexStart + l.indexCount) / 3; t++) {
          const a = tri2(m, t);
          // float32 positions can tip a sliver triangle (area ~0) the other way; nothing visible is that small
          expect(a, `${l.name}: triangle ${t} faces +z`).toBeGreaterThanOrEqual(-1e-6);
          filled += a / 2;
          for (let k = 0; k < 3; k++) {
            const v = m.indices[3 * t + k] as number;
            expect(
              v >= l.vertexStart && v < l.vertexStart + l.vertexCount,
              `${l.name}: its own vertices`,
            ).toBe(true);
          }
        }
        const area = loopArea(m, l);
        expect(Math.abs(filled - area), `${l.name}: filled ${filled} of ${area}`).toBeLessThanOrEqual(
          1e-6 * Math.max(1, area),
        );
      }
      expect(indexEnd).toBe(m.indices.length);
    },
  );

  test("the loops of a feature drawn as two half rings in one path are two loops (deck.gl's half-ring lesson)", () => {
    const rink = surfaceMesh("hockey", "nhl");
    const count = (name: string): number => rink.loops.filter((l) => l.name === name).length;
    expect(count("odzone_faceoff_circle")).toBe(8);
    expect(count("nodzone_faceoff_spot_ring")).toBe(16);
    // 16 loops in the paths, as in sdvplot/deckgl; the eight hash marks nearer centre ice cross themselves at their
    // corner (sporty draws their L's end past the bend), and each splits there into its two strokes
    expect(count("odzone_faceoff_lines")).toBe(24);
    expect(count("goaltenders_restricted_area")).toBe(6); // each trapezoid twists at both corners: three pieces
    // a circle's two half rings, consecutive, fill the same area: neither is filled across its open side
    const halves = rink.loops.filter((l) => l.name === "odzone_faceoff_circle");
    for (let i = 0; i < halves.length; i += 2) {
      const [a, b] = [
        loopArea(rink, halves[i] as SurfaceMesh["loops"][number]),
        loopArea(rink, halves[i + 1] as SurfaceMesh["loops"][number]),
      ];
      expect(Math.abs(a - b) / a).toBeLessThan(0.01);
    }
  });

  test("colours are each feature's sporty fill, in three's linear-sRGB working space, alpha kept", () => {
    const m = surfaceMesh("baseball", "mlb");
    const scene = surface("baseball", "mlb");
    const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    for (const l of m.loops) {
      const want =
        l.name === "background" ? scene.background : scene.features.find((f) => f.name === l.name)?.fill;
      expect(l.color).toBe(want);
      const rgb = [1, 3, 5].map((i) => lin(Number.parseInt((want as string).slice(i, i + 2), 16) / 255));
      for (let d = 0; d < 3; d++) expect(m.colors[4 * l.vertexStart + d]).toBeCloseTo(rgb[d] as number, 6);
      expect(m.colors[4 * l.vertexStart + 3]).toBe(1);
    }
    // a translucent fill keeps its alpha (the rink's goal crease, say)
    const rink = surfaceMesh("hockey", "nhl");
    const see = surface("hockey", "nhl").features.find(
      (f) => f.kind === "polygon" && f.fill.length === 9 && !f.fill.endsWith("00"),
    );
    expect(see, "a translucent rink feature").toBeDefined();
    const l = rink.loops.find((x) => x.name === see?.name) as SurfaceMesh["loops"][number];
    expect(rink.colors[4 * l.vertexStart + 3]).toBeCloseTo(
      Number.parseInt((see?.fill as string).slice(7), 16) / 255,
      6,
    );
  });

  test("baseball: the field's background (the outfield grass) is the first loop, under everything, over the bbox", () => {
    const m = surfaceMesh("baseball", "mlb");
    const [first] = m.loops;
    expect(first?.name).toBe("background");
    expect(first?.vertexCount).toBe(4);
    const xs = [0, 1, 2, 3].map((i) => at(m.positions, i)[0]);
    const ys = [0, 1, 2, 3].map((i) => at(m.positions, i)[1]);
    expect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]).toEqual(
      m.bbox.map((v) => Math.fround(v)),
    );
    // home plate's point is the origin and its front edge is 17/12 ft out: Statcast's frame, so pitches need no conversion
    const plate = m.loops.find((l) => l.name === "home_plate") as SurfaceMesh["loops"][number];
    const ys2 = Array.from(
      { length: plate.vertexCount },
      (_, i) => at(m.positions, plate.vertexStart + i)[1],
    );
    expect(Math.min(...ys2)).toBe(0);
    expect(Math.max(...ys2)).toBeCloseTo(17 / 12, 3);
    expect(surfaceMesh("hockey", "nhl").loops[0]?.name).not.toBe("background"); // a rink has no background colour
  });

  test("hidden features and text are left out; sporty's options pass through (units, colorUpdates)", () => {
    const scene = surface("football", "nfl");
    const polygons = new Set(scene.features.flatMap((f) => (f.kind === "polygon" ? [f.name] : [])));
    expect(scene.features.some((f) => f.kind === "text")).toBe(true); // the yard numbers
    for (const l of surfaceMesh("football", "nfl").loops) expect(polygons.has(l.name), l.name).toBe(true);
    const hidden = surfaceMesh("baseball", "mlb", { colorUpdates: { infield_dirt: "#00000000" } });
    expect(hidden.loops.some((l) => l.name === "infield_dirt")).toBe(false);
    expect(surfaceMesh("soccer", "fifa", { units: "ft" }).units).toBe("ft");
    const red = surfaceMesh("baseball", "mlb", { colorUpdates: { infield_dirt: "#ff0000" } });
    expect(red.loops.find((l) => l.name === "infield_dirt")?.color).toBe("#ff0000");
  });
});

describe("teamColorPalette", () => {
  test("light default: the teams' own colours; an unresolved team takes the fallback", () => {
    expect(teamColorPalette("mlb", ["NYY", "CWS"])).toEqual(teamColorsSync("mlb", ["NYY", "CWS"]));
    const w = warnings(() => expect(teamColorPalette("mlb", ["XXX", "NYY"])[0]).toBe("#808080"));
    expect(w.join()).not.toMatch(/\b(null|undefined)\b/);
  });

  test("an unresolved team stays out of the palette: it never moves a real team's colour", () => {
    // the fallback is the Yankees' own navy: in the palette, it would push the Yankees ΔE 20 away from their colour
    const [nyy] = teamColorsSync("mlb", ["NYY"]) as [string];
    const alone = teamColorPalette("mlb", ["NYY"], { background: "#ffffff" });
    expect(alone).toEqual([nyy]);
    expect(teamColorPalette("mlb", ["XXX", "NYY"], { background: "#ffffff", fallback: nyy })).toEqual([
      nyy,
      nyy,
    ]);
  });

  const LEAGUES = ["nba", "nfl", "mlb", "nhl"] as const;
  test.each(LEAGUES.flatMap((lg) => ["#181a1b", "#000000", "#ffffff"].map((bg) => [lg, bg] as const)))(
    "dark mode (Review Focus 4): %s in league order on %s, every colour reads (3:1), every pair MIN_DELTA_E apart, no warning",
    (lg, background) => {
      const teams = getLeagueSync(lg).teams.map((t) => t.team_id);
      let c: string[] = [];
      const w = warnings(() => {
        c = teamColorPalette(lg, teams, { background, idSystem: "team_id" });
      });
      expect(w).toEqual([]);
      for (const x of c) expect(contrast(x, background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      const close = c.flatMap((x, i) =>
        c.slice(0, i).flatMap((p, j) => (deltaE(x, p) < MIN_DELTA_E ? [`${teams[j]}/${teams[i]}`] : [])),
      );
      expect(close).toEqual([]);
    },
  );
});
