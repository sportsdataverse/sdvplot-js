// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { contrast } from "../src/contrast.js";
import { InputError, UnsupportedTargetError } from "../src/errors.js";
import {
  loadLeague,
  logoUrlSync,
  placeSync,
  resetWarnings,
  resolveSync,
  setWarningHandler,
  teamColorsSync,
} from "../src/index.js";
import { MIN_DELTA_E, deltaE } from "../src/team-palette.js";
import { type UPlotLike, drawnMarks, logoPlugin, withTeamSeries } from "../src/uplot.js";
import { BUF, KC, ROWS, ROWS_UNKNOWN } from "./_fixtures.js";
import { type Call, calls, mockCanvas } from "./chartjs/harness.js";

/** jsdom never loads an image: this one loads (or fails) when the test says so. */
class FakeImage {
  static made: FakeImage[] = [];
  src = "";
  crossOrigin: string | null = null;
  complete = false;
  naturalWidth = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeImage.made.push(this);
  }
  land(): void {
    this.complete = true;
    this.naturalWidth = 500;
    this.onload?.();
  }
  fail(): void {
    this.complete = true;
    this.onerror?.();
  }
}
const landAll = async (): Promise<void> => {
  for (const i of FakeImage.made) if (!i.complete) i.land();
  await tick(); // uPlot commits a redraw in a microtask
};

// uPlot reads matchMedia when it loads and draws series through Path2D; jsdom has neither.
vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
vi.stubGlobal(
  "Path2D",
  class {
    constructor() {
      // biome-ignore lint/correctness/noConstructorReturn: a no-op stand-in for every Path2D method
      return new Proxy(this, { get: (t, k) => (k in t ? (t as never)[k] : () => {}) });
    }
  },
);
const { default: uPlot } = await import("uplot");

beforeAll(() => {
  mockCanvas();
  vi.stubGlobal("Image", FakeImage);
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  resetWarnings();
  FakeImage.made = [];
});

const ID = (t: string, league = "nfl" as const) => resolveSync(t, league) as string;
const tick = () => new Promise((r) => setTimeout(r, 0));
const draws = (u: UPlotLike): Call[] =>
  (calls.get(u.ctx.canvas as HTMLCanvasElement) ?? []).filter(([n]) => n === "drawImage");
const aspectOf = (team: string): number => placeSync([0], [0], [team], { league: "nfl" })[0]?.aspect ?? 1;

type Opts = ConstructorParameters<typeof uPlot>[0];
async function chart(
  plugins: Opts["plugins"],
  data: [number[], number[]] = [
    [0, 10, 20, 30],
    [-10, -3, -7, 0],
  ],
  scales: Opts["scales"] = {},
): Promise<InstanceType<typeof uPlot>> {
  const el = document.body.appendChild(document.createElement("div"));
  const u = new uPlot(
    {
      width: 600,
      height: 400,
      scales: { x: { time: false }, ...scales },
      series: [{}, { stroke: "#333333" }],
      plugins: plugins ?? [],
    },
    data,
    el,
  );
  await tick();
  return u;
}

describe("logoPlugin", () => {
  test("draws each row's logo centred on uPlot's valToPos of its x and y, height of the plot tall", async () => {
    const plugin = logoPlugin(ROWS, { x: "x", y: "y", team: "team", league: "nfl", height: 0.1 });
    expect(FakeImage.made).toEqual([]); // building the options fetches nothing
    const u = await chart([plugin]);
    // preloaded as the chart starts, before its first draw
    expect(FakeImage.made.map((i) => i.src)).toEqual([logoUrlSync(KC, "nfl"), logoUrlSync(BUF, "nfl")]);
    expect(FakeImage.made.every((i) => i.crossOrigin === "anonymous")).toBe(true);
    expect(draws(u)).toEqual([]); // nothing until the images load
    await landAll(); // each load redraws the chart
    const got = draws(u);
    expect(got).toHaveLength(2);
    ROWS.forEach((r, i) => {
      const [img, x, y, w, h, alpha] = got[i]?.[1] as [FakeImage, number, number, number, number, number];
      const ph = 0.1 * u.bbox.height;
      expect(img.src).toBe(logoUrlSync(r.team, "nfl"));
      expect(h).toBeCloseTo(ph);
      expect(w).toBeCloseTo(ph * aspectOf(r.team));
      expect(x + w / 2).toBeCloseTo(u.valToPos(r.x, "x", true));
      expect(y + h / 2).toBeCloseTo(u.valToPos(r.y, "y", true));
      expect(alpha).toBe(1);
    });
  });

  test("drawnMarks reads back [team id, x, y, height, url]: height is the fraction of the plot asked for", async () => {
    const u = await chart([logoPlugin(ROWS, { x: "x", y: "y", team: "team", league: "nfl", height: 0.25 })]);
    expect(drawnMarks(u)).toEqual([]);
    await landAll();
    const marks = drawnMarks(u);
    expect(marks.map((m) => m.slice(0, 3))).toEqual([
      [ID(KC), 10, -3],
      [ID(BUF), 20, -7],
    ]);
    expect(marks.map((m) => m[3])).toEqual([0.25, 0.25]); // the size contract: a fraction of bbox.height
    expect(marks.map((m) => m[4])).toEqual([logoUrlSync(KC, "nfl"), logoUrlSync(BUF, "nfl")]);
  });

  test("alpha is the images' opacity, and the context is left as it was found", async () => {
    const u = await chart([logoPlugin(ROWS, { x: "x", y: "y", team: "team", league: "nfl", alpha: 0.4 })]);
    await landAll();
    expect(draws(u).map((c) => c[1][5])).toEqual([0.4, 0.4]);
    // the images sit between a save and a restore, so the alpha never leaks into what uPlot draws next
    const names = (calls.get(u.ctx.canvas as HTMLCanvasElement) ?? []).map(([n]) => n);
    const first = names.lastIndexOf("drawImage") - 1;
    expect(names.slice(first - 1, first + 3)).toEqual(["save", "drawImage", "drawImage", "restore"]);
  });

  test("a team with no logo draws nothing and warns once, as sdvplot/echarts does", async () => {
    const seen: string[] = [];
    setWarningHandler((m) => seen.push(m));
    const u = await chart([logoPlugin(ROWS_UNKNOWN, { x: "x", y: "y", team: "team", league: "nfl" })]);
    await landAll();
    u.redraw(false);
    await tick();
    setWarningHandler(null);
    expect(drawnMarks(u).map((m) => m[0])).toEqual([ID(KC)]);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("XXX");
  });

  test("an image that fails to load is never drawn (no broken image) and warns once", async () => {
    const seen: string[] = [];
    setWarningHandler((m) => seen.push(m));
    const u = await chart([logoPlugin(ROWS, { x: "x", y: "y", team: "team", league: "nfl" })]);
    FakeImage.made[0]?.fail();
    FakeImage.made[1]?.land();
    u.redraw(false);
    await tick();
    setWarningHandler(null);
    expect(drawnMarks(u).map((m) => m[0])).toEqual([ID(BUF)]);
    expect(seen).toEqual([`could not load ${logoUrlSync(KC, "nfl")}, so it is not drawn`]);
  });

  test("a row whose point is outside the plot area (a zoom) is not drawn over the axes", async () => {
    const u = await chart([logoPlugin(ROWS, { x: "x", y: "y", team: "team", league: "nfl" })], undefined, {
      x: { time: false, range: [0, 15] },
    });
    await landAll();
    expect(drawnMarks(u).map((m) => m[0])).toEqual([ID(KC)]);
  });

  test("rows as a function of the chart follow live data: setData moves an end logo to the newest point", async () => {
    const end = (u: UPlotLike) => {
      const [xs, ys] = u.data as [number[], number[]];
      const i = xs.length - 1;
      return [{ x: xs[i], y: ys[i], team: "KC" }];
    };
    const u = await chart([logoPlugin(end, { x: "x", y: "y", team: "team", league: "nfl" })]);
    await landAll();
    expect(drawnMarks(u).map((m) => m.slice(0, 3))).toEqual([[ID(KC), 30, 0]]);
    u.setData([
      [0, 10, 20, 30, 40],
      [-10, -3, -7, 0, 6],
    ]);
    await tick();
    expect(drawnMarks(u).map((m) => m.slice(0, 3))).toEqual([[ID(KC), 40, 6]]);
    expect(FakeImage.made).toHaveLength(1); // the logo loads once
  });

  test("validates height (a fraction of the plot, not px), alpha and the columns", () => {
    const o = { x: "x", y: "y", team: "team", league: "nfl" } as const;
    for (const height of [0, 1.5, 24, Number.NaN])
      expect(() => logoPlugin(ROWS, { ...o, height })).toThrow(InputError);
    expect(() => logoPlugin(ROWS, { ...o, height: 1 })).not.toThrow();
    expect(() => logoPlugin(ROWS, { ...o, alpha: 2 })).toThrow(InputError);
    expect(() => logoPlugin(ROWS, { ...o, team: "club" })).toThrow(/team column "club"/);
  });
});

describe("withTeamSeries", () => {
  const opts = () => ({
    width: 600,
    height: 300,
    series: [{ label: "Minute" }, { label: "Kansas City", width: 2 }, { label: "Buffalo" }],
  });

  test("strokes series i + 1 in row i's team colour, keeps the rest of each series, and copies", () => {
    const o = opts();
    const got = withTeamSeries(o, [{ team: KC }, { team: BUF }], { team: "team", league: "nfl" });
    const [kc, buf] = teamColorsSync("nfl", [KC, BUF]) as string[];
    expect(got.series).toEqual([
      { label: "Minute" },
      { label: "Kansas City", width: 2, stroke: kc },
      { label: "Buffalo", stroke: buf },
    ]);
    expect(o.series[1]).toEqual({ label: "Kansas City", width: 2 }); // the input is not mutated
    expect(got.width).toBe(600);
  });

  test("fill: an area under each line in the team colour at that opacity", () => {
    const got = withTeamSeries(opts(), [{ team: KC }], { team: "team", league: "nfl", fill: 0.2 });
    const n = Number.parseInt((teamColorsSync("nfl", KC) as string).slice(1), 16);
    expect(got.series[1]).toMatchObject({ fill: `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0.2)` });
    expect(got.series[2]).toEqual({ label: "Buffalo" }); // fewer rows than series: the rest are left alone
    expect(() => withTeamSeries(opts(), [{ team: KC }], { team: "team", league: "nfl", fill: 2 })).toThrow(
      InputError,
    );
  });

  test("an unresolved team takes the fallback colour; more rows than series, or no options object, throw", () => {
    const got = withTeamSeries(opts(), [{ team: "XXX" }], {
      team: "team",
      league: "nfl",
      fallback: "#999999",
    });
    expect(got.series[1]).toMatchObject({ stroke: "#999999" });
    const three = [{ team: KC }, { team: BUF }, { team: KC }];
    expect(() => withTeamSeries(opts(), three, { team: "team", league: "nfl" })).toThrow(InputError);
    expect(() => withTeamSeries(null as never, [], { team: "team", league: "nfl" })).toThrow(
      UnsupportedTargetError,
    );
    expect(() => withTeamSeries({ width: 1 } as never, [], { team: "team", league: "nfl" })).toThrow(
      UnsupportedTargetError,
    );
  });

  test("resolves teams as logoPlugin does: the colour of each drawn mark's team id is the colour of its row", async () => {
    await loadLeague("nba");
    const rows = [
      { x: 10, y: -3, team: "Clippers" },
      { x: 20, y: -7, team: "PHX" },
      { x: 30, y: 0, team: "Los Angeles Lakers" },
    ];
    const series = { series: [{}, {}, {}, {}] };
    const u = await chart([logoPlugin(rows, { x: "x", y: "y", team: "team", league: "nba" })]);
    await landAll();
    const ids = drawnMarks(u).map((m) => ({ team: m[0] }));
    expect(ids).toHaveLength(3);
    for (const background of [undefined, "#181a1b"]) {
      const o = { team: "team", league: "nba", ...(background ? { background } : {}) } as const;
      expect(withTeamSeries(series, ids, o)).toEqual(withTeamSeries(series, rows, o));
    }
    const strokes = withTeamSeries(series, rows, { team: "team", league: "nba" }).series.map(
      (s) => (s as { stroke?: string }).stroke,
    );
    expect(new Set(strokes.slice(1)).size).toBe(3); // three teams, three colours: not three fallbacks
  });

  test("dark mode: with a background, every team colour keeps at least 3:1 contrast against it", async () => {
    await loadLeague("nba");
    // biome-ignore format: the 30 teams, one line
    const teams = [
      "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GS", "HOU", "IND", "LAC", "LAL", "MEM",
      "MIA", "MIL", "MIN", "NO", "NY", "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SA", "TOR", "UTAH", "WSH",
    ];
    const rows = teams.map((team) => ({ team }));
    const many = { series: [{}, ...teams.map(() => ({}))] };
    const strokes = (background?: string): string[] =>
      withTeamSeries(many, rows, { team: "team", league: "nba", ...(background ? { background } : {}) })
        .series.slice(1)
        .map((s) => (s as { stroke: string }).stroke);
    for (const background of ["#181a1b", "#000000", "#ffffff"]) {
      const c = strokes(background);
      expect(c).toHaveLength(30);
      for (const x of c) expect(contrast(x, background)).toBeGreaterThanOrEqual(3);
    }
    // a colour that already reads, and sits apart from every earlier team's, is kept as it is; no two teams share one
    const plain = strokes();
    const dark = strokes("#181a1b");
    dark.forEach((x, i) => {
      const apart = dark.slice(0, i).every((p) => deltaE(plain[i] as string, p) >= MIN_DELTA_E);
      if (contrast(plain[i] as string, "#181a1b") >= 3 && apart) expect(x).toBe(plain[i]);
    });
    expect(new Set(dark).size).toBe(30);
    // the light default (no background) is the plain team colours, untouched by either pass
    expect(plain).toEqual((teamColorsSync("nba", teams) as string[]).map((c) => c.toLowerCase()));
  });

  test("the Lakers and the Warriors on a dark chart get two colours, both readable and distinct", async () => {
    await loadLeague("nba");
    const got = withTeamSeries({ series: [{}, {}, {}] }, [{ team: "LAL" }, { team: "GS" }], {
      team: "team",
      league: "nba",
      background: "#181a1b",
    }).series.map((s) => (s as { stroke?: string }).stroke);
    const [lal, gs] = got.slice(1) as [string, string];
    expect(deltaE(lal, gs)).toBeGreaterThanOrEqual(MIN_DELTA_E);
    for (const c of [lal, gs]) expect(contrast(c, "#181a1b")).toBeGreaterThanOrEqual(3);
  });
});
