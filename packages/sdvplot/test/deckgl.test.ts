import { surface } from "@sportsdataverse/sporty";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { contrast } from "../src/contrast.js";
import {
  type ArcRow,
  type IconRow,
  type SurfaceRow,
  logoIconLayer,
  passArcLayer,
  surfaceLayer,
} from "../src/deckgl.js";
import { InputError } from "../src/errors.js";
import { logoUrlSync, resetWarnings, resolveSync, setWarningHandler, teamColorsSync } from "../src/index.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE, teamPalette } from "../src/team-palette.js";
import "./_fixtures.js"; // preloads every league

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own

// Real rows: the first shots of game 7 of the 2024 Stanley Cup Final (NHL api-web play-by-play, the examples'
// NHL_SHOTS) and France's first completed passes of the 2018 World Cup final (StatsBomb open data through SPADL, the
// examples' WC2018_FINAL_FRANCE_PASSES; France is ESPN soccer team 478).
const SHOTS = [
  { event_id: 251, team: "EDM", x: 82, y: -3 },
  { event_id: 55, team: "FLA", x: -81, y: 30 },
  { event_id: 81, team: "EDM", x: 64, y: 4 },
];
const PASSES = [
  {
    action_id: 42,
    team: "478",
    start_x: 54.68750000000001,
    start_y: 6.375,
    end_x: 56.4375,
    end_y: 1.2750000000000057,
  },
  { action_id: 46, team: "478", start_x: 22.3125, start_y: 9.775000000000006, end_x: 6.5625, end_y: 31.875 },
];
const ARC = {
  x: "start_x",
  y: "start_y",
  xend: "end_x",
  yend: "end_y",
  team: "team",
  league: "soccer",
} as const;
const FRANCE = { ...ARC, idSystem: "team_id" } as const;
const rgba = (hex: string): number[] =>
  [1, 3, 5, 7].map((i) => Number.parseInt(hex.slice(i, i + 2) || "ff", 16));
const hex = ([r, g, b]: readonly number[]): string =>
  `#${[r, g, b].map((v) => (v as number).toString(16).padStart(2, "0")).join("")}`;
/** Calls an accessor prop on a row, as deck.gl does (a constant is returned as it is). */
const call = (accessor: unknown, row: unknown): unknown =>
  typeof accessor === "function" ? (accessor as (d: unknown) => unknown)(row) : accessor;
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

describe("logoIconLayer", () => {
  test("one icon per row at the row's (x, y), the team's logo by URL (deck.gl's auto-packed icons), centred", () => {
    const p = logoIconLayer(SHOTS, { x: "x", y: "y", team: "team", league: "nhl" });
    const data = p.data as IconRow[];
    expect(data.map((d) => call(p.getPosition, d))).toEqual([
      [82, -3],
      [-81, 30],
      [64, 4],
    ]);
    const edm = logoUrlSync("EDM", "nhl") as string;
    const fla = logoUrlSync("FLA", "nhl") as string;
    expect(data.map((d) => (call(p.getIcon, d) as { url: string }).url)).toEqual([edm, fla, edm]);
    // the archive's EDM and FLA logos are 500 x 500: the atlas cell keeps that aspect, 128 px tall
    expect(call(p.getIcon, data[0])).toEqual({ url: edm, width: 128, height: 128, anchorY: 64, mask: false });
    expect(data.map((d) => d.team)).toEqual(resolveSync(["EDM", "FLA", "EDM"], "nhl"));
    expect(data.map((d) => d.index)).toEqual([0, 1, 2]);
    expect(p).toMatchObject({ id: "sdvplot-logos", getSize: 32, sizeUnits: "pixels", opacity: 1 });
  });

  test("size is the logo's height in px and alpha the layer's opacity; a fractional size or bad alpha throws", () => {
    const p = logoIconLayer(SHOTS, {
      x: "x",
      y: "y",
      team: "team",
      league: "nhl",
      size: 48,
      alpha: 0.5,
      id: "shots",
    });
    expect(p).toMatchObject({ id: "shots", getSize: 48, opacity: 0.5 });
    for (const size of [0.1, 0, Number.NaN])
      expect(() => logoIconLayer(SHOTS, { x: "x", y: "y", team: "team", league: "nhl", size })).toThrow(
        InputError,
      );
    expect(() => logoIconLayer(SHOTS, { x: "x", y: "y", team: "team", league: "nhl", alpha: 2 })).toThrow(
      InputError,
    );
  });

  test("a team with no logo is left out (no broken image) with one warning, as the other adapters do", () => {
    const rows = [{ team: "XXX", x: 1, y: 1 }, ...SHOTS];
    let p: ReturnType<typeof logoIconLayer> | undefined;
    const w = warnings(() => {
      p = logoIconLayer(rows, { x: "x", y: "y", team: "team", league: "nhl" });
    });
    expect(w).toHaveLength(1);
    expect((p?.data as IconRow[]).map((d) => d.index)).toEqual([1, 2, 3]);
  });

  test("a column that is not in the rows throws", () => {
    expect(() => logoIconLayer(SHOTS, { x: "xc", y: "y", team: "team", league: "nhl" })).toThrow(InputError);
  });
});

describe("passArcLayer", () => {
  test("one arc per row from (x, y) to (xend, yend), the team's primary colour at the source, its secondary at the target", () => {
    const p = passArcLayer(PASSES, FRANCE);
    const data = p.data as ArcRow[];
    expect(data.map((d) => [call(p.getSourcePosition, d), call(p.getTargetPosition, d)])).toEqual(
      PASSES.map((r) => [
        [r.start_x, r.start_y],
        [r.end_x, r.end_y],
      ]),
    );
    const [primary] = teamColorsSync("soccer", ["478"], { idSystem: "team_id" });
    const [secondary] = teamColorsSync("soccer", ["478"], { idSystem: "team_id", which: "secondary" });
    for (const d of data) {
      expect(call(p.getSourceColor, d)).toEqual(rgba(primary as string));
      expect(call(p.getTargetColor, d)).toEqual(rgba(secondary as string));
      expect(d.team).toBe("478");
    }
    expect(p).toMatchObject({ id: "sdvplot-arcs", getWidth: 2, widthUnits: "pixels", opacity: 1 });
    expect("getTilt" in p).toBe(false);
  });

  test("which: secondary swaps the ends; tilt lays the arcs flat (90) and is checked", () => {
    const p = passArcLayer(PASSES, { ...FRANCE, which: "secondary", tilt: 90, width: 3 });
    const [d] = p.data as ArcRow[];
    const [primary] = teamColorsSync("soccer", ["478"], { idSystem: "team_id" });
    expect(call(p.getTargetColor, d)).toEqual(rgba(primary as string));
    expect(p).toMatchObject({ getTilt: 90, getWidth: 3 });
    expect(() => passArcLayer(PASSES, { ...FRANCE, tilt: 91 })).toThrow(InputError);
    expect(() => passArcLayer(PASSES, { ...FRANCE, width: 0 })).toThrow(InputError);
    expect(passArcLayer(PASSES, { ...FRANCE, height: 0.3 })).toMatchObject({ getHeight: 0.3 });
    expect("getHeight" in passArcLayer(PASSES, FRANCE)).toBe(false);
    expect(() => passArcLayer(PASSES, { ...FRANCE, height: -1 })).toThrow(InputError);
  });

  test("dark mode (Review Focus 4): with a background every colour reads at 3:1, through the shared team palette", () => {
    const background = "#181a1b";
    const p = passArcLayer(PASSES, { ...FRANCE, background });
    const [d] = p.data as ArcRow[];
    const source = hex(call(p.getSourceColor, d) as number[]);
    const target = hex(call(p.getTargetColor, d) as number[]);
    const [primary] = teamColorsSync("soccer", ["478"], { idSystem: "team_id" });
    const [secondary] = teamColorsSync("soccer", ["478"], { idSystem: "team_id", which: "secondary" });
    expect(contrast(primary as string, background)).toBeLessThan(MIN_CONTRAST); // France's navy on a dark chart
    expect(source).toBe(teamPalette([primary as string], [secondary], background)[0]);
    expect(target).toBe(teamPalette([secondary as string], [primary], background)[0]);
    for (const c of [source, target]) expect(contrast(c, background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  test("teams keep one colour each, in order of first appearance, and stay distinct (the Lakers and the Warriors)", () => {
    const rows = [
      { team: "GS", x: 0, y: 0, xe: 1, ye: 1 },
      { team: "LAL", x: 0, y: 0, xe: 2, ye: 2 },
      { team: "GS", x: 0, y: 0, xe: 3, ye: 3 },
    ];
    const o = {
      x: "x",
      y: "y",
      xend: "xe",
      yend: "ye",
      team: "team",
      league: "nba",
      background: "#181a1b",
    } as const;
    const p = passArcLayer(rows, o);
    const src = (p.data as ArcRow[]).map((d) => hex(call(p.getSourceColor, d) as number[]));
    expect(src[0]).toBe(src[2]);
    expect(deltaE(src[0] as string, src[1] as string)).toBeGreaterThanOrEqual(MIN_DELTA_E);
    expect((p.data as ArcRow[]).map((d) => d.team)).toEqual(resolveSync(["GS", "LAL", "GS"], "nba"));
  });

  test("an unknown team takes the fallback grey; a row with a missing end is left out with one warning", () => {
    const rows = [
      { team: "XXX", start_x: 1, start_y: 1, end_x: 2, end_y: 2 },
      { team: "478", start_x: 1, start_y: null, end_x: 2, end_y: 2 },
      ...PASSES,
    ];
    let p: ReturnType<typeof passArcLayer> | undefined;
    const w = warnings(() => {
      p = passArcLayer(rows, FRANCE);
    });
    expect(w).toHaveLength(2); // the resolver's, and the missing end's
    const data = p?.data as ArcRow[];
    expect(data.map((d) => d.index)).toEqual([0, 2, 3]);
    expect(call(p?.getSourceColor, data[0])).toEqual(rgba("#808080"));
    expect(data[0]?.team).toBe("XXX");
  });
});

test("passArcLayer: on a background where only one of a team's colours reads, both ends take it; where both read, they differ", () => {
  const ends = (background: string) => {
    const [d] = passArcLayer(PASSES, { ...FRANCE, background }).data as ArcRow[];
    return [hex(d?.sourceColor ?? []), hex(d?.targetColor ?? [])];
  };
  // sporty's default grass: France's navy is under 3:1, so the source end takes the mint too (the documented caveat)
  const [s1, t1] = ends("#195f0c");
  expect(s1).toBe(t1);
  // the france-passes example's mid-tone grass: navy and mint both read, so the arcs show their direction
  const [s2, t2] = ends("#4a7f3a");
  expect(s2).not.toBe(t2);
  for (const c of [s2, t2]) expect(contrast(c as string, "#4a7f3a")).toBeGreaterThanOrEqual(MIN_CONTRAST);
});

test("passArcLayer: an unresolved team takes the fallback as given and stays out of the palette", () => {
  // a grey background on which the fallback grey does not read: the palette would have moved it
  const background = "#7a7a7a";
  const rows = [{ team: "XXX", start_x: 1, start_y: 1, end_x: 2, end_y: 2 }, ...PASSES];
  let p: ReturnType<typeof passArcLayer> | undefined;
  const w = warnings(() => {
    p = passArcLayer(rows, { ...FRANCE, background });
  });
  expect(w.some((m) => /\bnull\b/.test(m))).toBe(false);
  const data = p?.data as ArcRow[];
  expect(call(p?.getSourceColor, data[0])).toEqual(rgba("#808080"));
  expect(call(p?.getTargetColor, data[0])).toEqual(rgba("#808080"));
  // France's colours are the palette of France alone: the unresolved team did not take a place in it
  const [primary] = teamColorsSync("soccer", ["478"], { idSystem: "team_id" });
  const [secondary] = teamColorsSync("soccer", ["478"], { idSystem: "team_id", which: "secondary" });
  expect(hex(call(p?.getSourceColor, data[1]) as number[])).toBe(
    teamPalette([primary as string], [secondary], background)[0],
  );
});

test("passArcLayer: an unresolved team is named by its value as text, as sdvplot.pydeck names it", () => {
  const rows = [
    { team: null, start_x: 1, start_y: 1, end_x: 2, end_y: 2 },
    { team: 123456, start_x: 1, start_y: 1, end_x: 2, end_y: 2 },
  ];
  let p: ReturnType<typeof passArcLayer> | undefined;
  warnings(() => {
    p = passArcLayer(rows, FRANCE);
  });
  expect((p?.data as ArcRow[]).map((d) => d.team)).toEqual(["", "123456"]);
  expect((p?.data as ArcRow[]).map((d) => call(p?.getSourceColor, d))).toEqual([
    rgba("#808080"),
    rgba("#808080"),
  ]);
});

describe("surfaceLayer", () => {
  test("sporty's rink as PolygonLayer props in the rink's own frame (deck.gl's cartesian coordinates), feet", () => {
    const p = surfaceLayer("hockey", "nhl");
    const scene = surface("hockey", "nhl");
    const polys = scene.features.filter((f) => f.kind === "polygon");
    const data = p.data as SurfaceRow[];
    // one row per closed loop, in sporty's order: the same features, their points kept (a ring split where it crosses
    // itself also gains the crossing point)
    const names = data.map((d) => d.name).filter((n, i, a) => n !== a[i - 1]);
    expect(names).toEqual(polys.map((f) => f.name).filter((n, i, a) => n !== a[i - 1]));
    const drawnPts = new Set(data.flatMap((d) => d.polygon.map((pt) => pt.join())));
    // all but the corners of each goal crease where its inner arc meets a straight side: rounding (6e-16 ft) puts the
    // arc's end across the side, and the zero-width sliver split off there is left out as empty
    const lost = polys.flatMap((f) => f.points).filter((pt) => !drawnPts.has(pt.join()));
    expect(lost.length).toBeLessThanOrEqual(8);
    for (const [x, y] of lost) {
      expect(Math.abs(x)).toBeGreaterThan(84);
      expect(Math.abs(y)).toBeCloseTo(4 - 2 / 12, 3);
    }
    expect(call(p.getPolygon, data[0])).toEqual(polys[0]?.points);
    expect(call(p.getFillColor, data[0])).toEqual(rgba(polys[0]?.fill as string));
    // the goal frame fill is translucent (#a5acaf4d): its alpha survives
    const fill = data.find((d) => d.name === "goal_frame_fill");
    expect(call(p.getFillColor, fill)).toEqual([165, 172, 175, 77]);
    expect(p).toMatchObject({
      id: "sdvplot-surface",
      coordinateSystem: "cartesian",
      filled: true,
      stroked: false,
    });
  });

  test("a faceoff circle's two half rings, one path in sporty, are two loops that each close: deck.gl fills each as drawn", () => {
    const scene = surface("hockey", "nhl");
    const circles = scene.features.filter((f) => f.kind === "polygon" && f.name === "odzone_faceoff_circle");
    const rows = (surfaceLayer("hockey", "nhl").data as SurfaceRow[]).filter(
      (d) => d.name === "odzone_faceoff_circle",
    );
    expect(rows).toHaveLength(2 * circles.length);
    for (const r of rows) expect(r.polygon.at(-1)).toEqual(r.polygon[0]);
    // each half lies on one side of its circle's centre, as sporty draws it (a half ring, not a ring and a hole)
    const [left, right] = rows.slice(0, 2).map((r) => r.polygon.map((pt) => pt[0]));
    expect(Math.max(...(left as number[]))).toBeLessThanOrEqual(Math.min(...(right as number[])) + 1e-9);
  });

  test("a ring that crosses itself is split into simple rings, and a ring with no area is left out (as three does)", () => {
    type P = readonly [number, number];
    const turn = (a: P, b: P, c: P) => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    const crosses = (r: readonly P[]): boolean => {
      const n = r.length;
      for (let i = 0; i < n; i++)
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          const [a, b, c, d] = [r[i] as P, r[(i + 1) % n] as P, r[j] as P, r[(j + 1) % n] as P];
          if (
            Math.sign(turn(a, b, c)) * Math.sign(turn(a, b, d)) < 0 &&
            Math.sign(turn(c, d, a)) * Math.sign(turn(c, d, b)) < 0
          )
            return true;
        }
      return false;
    };
    const area = (r: readonly P[]) =>
      r.reduce((s, a, i) => {
        const b = r[(i + 1) % r.length] as P;
        return s + a[0] * b[1] - b[0] * a[1];
      }, 0) / 2;
    // since sportyR 2.4.1 sporty's features are simple rings; a faceoff L given a negative width crosses its own base
    const odd = { updates: { faceoff_line_width: -1 } };
    const twisted = surface("hockey", "nhl", odd).features.filter((f) => f.name === "odzone_faceoff_lines");
    expect(twisted.some((f) => f.kind === "polygon" && crosses(f.points))).toBe(true);
    const split = (surfaceLayer("hockey", "nhl", odd).data as SurfaceRow[]).filter(
      (d) => d.name === "odzone_faceoff_lines",
    );
    expect(split.filter((d) => crosses(d.polygon))).toEqual([]);
    expect(split.length).toBeGreaterThan(16);
    for (const [sport, league] of [
      ["hockey", "nhl"],
      ["lacrosse", "nll"],
      ["basketball", "nba"],
    ] as const) {
      const rows = surfaceLayer(sport, league).data as SurfaceRow[];
      expect(
        rows.filter((d) => crosses(d.polygon)).map((d) => d.name),
        `${sport} crossing`,
      ).toEqual([]);
      // the NLL goal fan goes out along a line and back: no area, as sporty's own SVG shows it (nothing)
      expect(
        rows.filter((d) => Math.abs(area(d.polygon)) < 1e-6).map((d) => d.name),
        `${sport} empty`,
      ).toEqual([]);
    }
    const nhl = surfaceLayer("hockey", "nhl").data as SurfaceRow[];
    expect(nhl.filter((d) => d.name === "goaltenders_restricted_area").length).toBeGreaterThan(2);
  });

  test("the NHL neutral-zone faceoff spots are drawn: each spot ring splits into its two half rings, none dropped", () => {
    // sportyR builds each half ring from (cos(pi/2) r, r) = (6.1e-17 r, r) back to an exact (0, r) (sportyR#79): at the
    // origin the "back at the first point" split would never fire and the two halves would cancel as one ~zero-area
    // ring. sporty places them at the spots (x = +-20, +-69 ft), where the 6e-17 rounds away; this holds that.
    const spots = surface("hockey", "nhl").features.filter((f) => f.name === "nodzone_faceoff_spot_ring");
    expect(spots.length).toBe(8);
    const rings = (surfaceLayer("hockey", "nhl").data as SurfaceRow[]).filter(
      (d) => d.name === "nodzone_faceoff_spot_ring",
    );
    expect(rings.length).toBe(2 * spots.length);
    const area = (r: readonly (readonly number[])[]): number =>
      Math.abs(
        r.reduce((s, p, i) => {
          const q = r[(i + 1) % r.length] as readonly number[];
          return s + (p[0] as number) * (q[1] as number) - (q[0] as number) * (p[1] as number);
        }, 0) / 2,
      );
    for (const r of rings) expect(area(r.polygon)).toBeGreaterThan(0.4); // a half ring of the spot's band, ~0.48 sq ft
  });

  test("a shorthand colour's alpha is read: #rgba is translucent, #rgb0 hides the feature", () => {
    const data = surfaceLayer("hockey", "nhl", { colorUpdates: { boards: "#f008", referee_crease: "#0000" } })
      .data as SurfaceRow[];
    expect(data.find((d) => d.name === "boards")?.fillColor).toEqual([255, 0, 0, 0x88]);
    expect(data.some((d) => d.name === "referee_crease")).toBe(false);
  });

  test("sporty's own options pass through (colour updates, pitch size); a hidden feature is left out", () => {
    const p = surfaceLayer("hockey", "nhl", {
      colorUpdates: { boards: "#ff4c00", referee_crease: "#00000000" },
    });
    const data = p.data as SurfaceRow[];
    expect(
      call(
        p.getFillColor,
        data.find((d) => d.name === "boards"),
      ),
    ).toEqual(rgba("#ff4c00"));
    expect(data.some((d) => d.name === "referee_crease")).toBe(false);
    const pitch = surfaceLayer("soccer", "fifa", { updates: { pitch_length: 105, pitch_width: 68 } });
    const xs = (pitch.data as SurfaceRow[]).flatMap((d) => d.polygon.map((pt) => pt[0]));
    expect(Math.max(...xs)).toBeCloseTo(55.2, 6); // half of 105 m, plus sporty's apron
  });

  test("text features (a football field's yard numbers) and hidden ones are left out: the layer holds polygons only", () => {
    const scene = surface("football", "nfl");
    expect(scene.features.some((f) => f.kind === "text")).toBe(true);
    // sporty hides 46 of the field's polygons by default (yardage marker boxes, red zone borders): fill alpha 00
    const shown = scene.features.filter((f) => f.kind === "polygon" && !/^#[0-9a-f]{6}00$/i.test(f.fill));
    expect(shown.length).toBeLessThan(scene.features.filter((f) => f.kind === "polygon").length);
    const data = surfaceLayer("football", "nfl").data as SurfaceRow[];
    expect(data.map((d) => d.name)).toEqual(shown.map((f) => f.name));
  });
});
