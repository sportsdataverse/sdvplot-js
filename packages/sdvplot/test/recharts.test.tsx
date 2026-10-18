// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { CartesianGrid, Line, LineChart, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { teamColorPalette as echartsPalette } from "../src/echarts.js";
import { InputError } from "../src/errors.js";
import { HEADSHOT_ASPECT, headshotUrl } from "../src/headshots.js";
import {
  contrast,
  loadLeague,
  logoUrlSync,
  resetWarnings,
  resolveSync,
  setWarningHandler,
  teamColorsSync,
} from "../src/index.js";
import { headshotDot, logoDot, logoTick, teamColorPalette } from "../src/recharts.js";
import { deltaE } from "../src/team-palette.js";
import { drawnMarks } from "../src/testing/index.js";
import { BUF, KC } from "./_fixtures.js";

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own
afterEach(cleanup);

const ID = (t: string) => resolveSync(t, "nfl") as string;
const URL_OF = (t: string, o = {}) => logoUrlSync(t, "nfl", o) as string;
/** Mount an SVG fragment and read back its <image> elements. */
const svg = (el: ReactElement | null) =>
  render(
    <svg role="img" aria-label="test">
      {el}
    </svg>,
  ).container;
const attrs = (img: Element) => ({
  href: img.getAttribute("href"),
  x: Number(img.getAttribute("x")),
  y: Number(img.getAttribute("y")),
  width: Number(img.getAttribute("width")),
  height: Number(img.getAttribute("height")),
});

describe("logoDot", () => {
  test("draws the row's team logo as an <image> centred on (cx, cy), size px tall at the mark's aspect", () => {
    const el = logoDot({ team: "team", league: "nfl", size: 30 })({ cx: 100, cy: 50, payload: { team: KC } });
    const img = svg(el).querySelector("image");
    expect(img).not.toBeNull();
    const a = attrs(img as Element);
    expect(a.href).toBe(URL_OF(KC));
    expect(a.height).toBe(30);
    expect(a.x + a.width / 2).toBeCloseTo(100);
    expect(a.y + a.height / 2).toBeCloseTo(50);
    expect(img?.getAttribute("aria-label")).toBe("KC logo");
    // drawnMarks (sdvplot/testing) reads it back: the team id, the centre, the url
    expect(drawnMarks(svg(el)).map((m) => [m.id, m.x, m.y, m.url, m.kind])).toEqual([
      [ID(KC), 100, 50, URL_OF(KC), "logo"],
    ]);
    // the px contract: Recharts gives no plot height, so drawnMarks' height is the size in px, not a fraction
    expect(drawnMarks(svg(el)).map((m) => m.height)).toEqual([30]);
  });

  test("a team with no logo draws nothing (no broken image) and warns once, as sdvplot/echarts does", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const dot = logoDot({ team: "team", league: "nfl" });
    const missing = dot({ cx: 1, cy: 2, payload: { team: "XXX" } });
    dot({ cx: 3, cy: 4, payload: { team: "XXX" } }); // a re-render does not warn again
    setWarningHandler(null);
    expect(missing).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(dot({ cx: 1, cy: 2, payload: {} })).toBeNull(); // no team value at all
    expect(dot({ payload: { team: KC } })).toBeNull(); // no position yet
  });

  test("last: true draws only the series' last point (an end-dot)", () => {
    const dot = logoDot({ team: "team", league: "nfl", last: true });
    const points = [{}, {}, {}];
    expect(dot({ cx: 1, cy: 1, index: 0, points, payload: { team: KC } })).toBeNull();
    expect(dot({ cx: 1, cy: 1, index: 2, points, payload: { team: KC } })).not.toBeNull();
  });

  test("last: true on a Scatter shape (no points) draws every point and warns once", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const dot = logoDot({ team: "team", league: "nfl", last: true });
    const a = dot({ cx: 1, cy: 1, index: 0, payload: { team: KC } });
    const b = dot({ cx: 2, cy: 2, index: 1, payload: { team: BUF } });
    setWarningHandler(null);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatch(/last.*Scatter/);
  });

  test("options: variant, season column, alpha, embed; bad size or alpha throws when the render prop is made", () => {
    const embed = new Map([[URL_OF(KC), "data:image/png;base64,AAAA"]]);
    const img = svg(
      logoDot({ team: "team", league: "nfl", alpha: 0.5, embed, season: "season" })({
        cx: 0,
        cy: 0,
        payload: { team: KC, season: 2024 },
      }),
    ).querySelector("image") as Element;
    expect(img.getAttribute("href")).toBe("data:image/png;base64,AAAA");
    expect(img.getAttribute("opacity")).toBe("0.5");
    expect(() => logoDot({ team: "team", league: "nfl", size: 0 })).toThrow(InputError);
    // the echarts habit, a fraction of the plot, would draw a 0.08 px image: it throws instead, naming the mistake
    for (const make of [
      () => logoDot({ team: "team", league: "nfl", size: 0.08 }),
      () => headshotDot({ player: "p", league: "nfl", size: 0.5 }),
      () => logoTick({ league: "nfl", size: 0.1 }),
    ])
      expect(make).toThrow(/size is a height in px, not a fraction of the plot/);
    expect(() => logoDot({ team: "team", league: "nfl", size: 1 })).not.toThrow();
    expect(() => logoDot({ team: "team", league: "nfl", alpha: 2 })).toThrow(InputError);
  });

  test("in a LineChart: one end-dot logo per team series, in its team colour line", () => {
    const series = [KC, BUF].map((team) => ({
      team,
      rows: [1, 2, 3].map((week) => ({ week, wins: week * (team === KC ? 1 : 0.5), team })),
    }));
    const colors = teamColorPalette("nfl", [KC, BUF]);
    const { container } = render(
      <LineChart width={500} height={300} margin={{ top: 20, right: 40, bottom: 20, left: 20 }}>
        <XAxis dataKey="week" type="number" domain={[1, 3]} />
        <YAxis />
        {series.map((s, i) => (
          <Line
            key={s.team}
            data={s.rows}
            dataKey="wins"
            stroke={colors[i] as string}
            isAnimationActive={false}
            dot={logoDot({ team: "team", league: "nfl", size: 24, last: true })}
          />
        ))}
      </LineChart>,
    );
    const marks = drawnMarks(container);
    expect(marks.map((m) => m.id).sort()).toEqual([ID(KC), ID(BUF)].sort());
    expect(marks.every((m) => Number.isFinite(m.x) && Number.isFinite(m.y))).toBe(true);
    const strokes = [...container.querySelectorAll(".recharts-line-curve")].map((p) =>
      p.getAttribute("stroke"),
    );
    expect(strokes).toEqual(colors);
  });
});

describe("headshotDot", () => {
  test("draws the player's ESPN headshot at 600:436 centred on the point; an id with no headshot draws nothing", () => {
    const dot = headshotDot({ player: "qb_espn_id", league: "nfl", size: 43.6 });
    const img = svg(dot({ cx: 10, cy: 20, payload: { qb_espn_id: "3139477" } })).querySelector(
      "image",
    ) as Element;
    const a = attrs(img);
    expect(a.href).toBe(headshotUrl("3139477", "nfl"));
    expect(a.width / a.height).toBeCloseTo(HEADSHOT_ASPECT);
    expect(a.x + a.width / 2).toBeCloseTo(10);
    const spy = vi.fn();
    setWarningHandler(spy);
    expect(dot({ cx: 10, cy: 20, payload: { qb_espn_id: "not-an-id" } })).toBeNull();
    setWarningHandler(null);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("in a ScatterChart as the series shape", () => {
    const rows = [
      { pf: 385, pa: 326, qb_espn_id: "3139477" },
      { pf: 402, pa: 301, qb_espn_id: "4038941" },
    ];
    const { container } = render(
      <ScatterChart width={400} height={300}>
        <XAxis dataKey="pf" type="number" domain={[300, 450]} />
        <YAxis dataKey="pa" type="number" domain={[250, 350]} />
        <Scatter
          data={rows}
          isAnimationActive={false}
          shape={headshotDot({ player: "qb_espn_id", league: "nfl" })}
        />
      </ScatterChart>,
    );
    expect(drawnMarks(container).map((m) => [m.id, m.kind])).toEqual([
      ["3139477", "headshot"],
      ["4038941", "headshot"],
    ]);
  });
});

describe("logoTick", () => {
  test("a category tick draws the team's logo under a bottom axis, centred on the tick", () => {
    const tick = logoTick({ league: "nfl", size: 20 });
    const img = svg(tick({ x: 100, y: 300, payload: { value: KC }, orientation: "bottom" })).querySelector(
      "image",
    ) as Element;
    const a = attrs(img);
    expect(a.href).toBe(URL_OF(KC));
    expect(a.height).toBe(20);
    expect(a.x + a.width / 2).toBeCloseTo(100);
    expect(a.y).toBe(300);
  });

  test("on a left axis the logo sits left of the tick, centred on it", () => {
    const img = svg(
      logoTick({ league: "nfl", size: 20 })({ x: 60, y: 120, payload: { value: KC }, orientation: "left" }),
    ).querySelector("image") as Element;
    const a = attrs(img);
    expect(a.x + a.width).toBeCloseTo(60);
    expect(a.y + a.height / 2).toBeCloseTo(120);
  });

  test("an unresolved category keeps its text label, as sdvplot/echarts' withAxisLogos does", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const c = svg(
      logoTick({ league: "nfl" })({ x: 10, y: 20, payload: { value: "XXX" }, orientation: "bottom" }),
    );
    setWarningHandler(null);
    expect(c.querySelector("image")).toBeNull();
    expect(c.querySelector("text")?.textContent).toBe("XXX");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("in a BarChart category axis: one logo per resolvable tick, the rest as text", async () => {
    const { BarChart, Bar } = await import("recharts");
    const rows = [
      { team: KC, wins: 15 },
      { team: "XXX", wins: 1 },
      { team: BUF, wins: 13 },
    ];
    setWarningHandler(() => {});
    const { container } = render(
      <BarChart width={400} height={300} data={rows}>
        <CartesianGrid />
        <XAxis dataKey="team" tick={logoTick({ league: "nfl" })} interval={0} />
        <YAxis />
        <Bar dataKey="wins" isAnimationActive={false} />
      </BarChart>,
    );
    setWarningHandler(null);
    expect(drawnMarks(container).map((m) => m.id)).toEqual([ID(KC), ID(BUF)]);
    expect(
      [...container.querySelectorAll(".recharts-cartesian-axis-tick-value")].map((t) => t.textContent),
    ).toContain("XXX");
  });
});

describe("teamColorPalette", () => {
  test("resolves teams as the drawn marks do: the palette of each mark's team id is the palette of its row value", async () => {
    await loadLeague("nba");
    const rows = [{ team: "Clippers" }, { team: "PHX" }, { team: "Los Angeles Lakers" }];
    const dot = logoDot({ team: "team", league: "nba" });
    const ids = rows.map((r, i) => drawnMarks(svg(dot({ cx: i, cy: i, payload: r })))[0]?.id);
    expect(ids.every((id) => id !== undefined)).toBe(true);
    const byValue = teamColorPalette(
      "nba",
      rows.map((r) => r.team),
    );
    expect(teamColorPalette("nba", ids)).toEqual(byValue);
    expect(teamColorPalette("nba", ids, { background: "#181a1b" })).toEqual(
      teamColorPalette(
        "nba",
        rows.map((r) => r.team),
        { background: "#181a1b" },
      ),
    );
    expect(new Set(byValue).size).toBe(3); // three teams, three colours: not three fallbacks
  });

  test("one colour per team, as sdvplot/echarts' palette, the fallback for an unresolved team", () => {
    const c = teamColorPalette("nfl", [KC, "XXX", BUF], { fallback: "#999999" });
    expect(c).toEqual(echartsPalette("nfl", [KC, "XXX", BUF], { fallback: "#999999" }));
    expect(c[1]).toBe("#999999");
  });

  // biome-ignore format: the 30 teams, one line
  const NBA = [
    "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GS", "HOU", "IND", "LAC", "LAL", "MEM",
    "MIA", "MIL", "MIN", "NO", "NY", "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SA", "TOR", "UTAH", "WSH",
  ];

  test("dark mode: every team colour reads (3:1) and stays distinct from every other (CIE76 dE 10)", async () => {
    await loadLeague("nba");
    const spy = vi.fn();
    setWarningHandler(spy);
    for (const background of ["#181a1b", "#000000", "#ffffff"]) {
      const c = teamColorPalette("nba", NBA, { background });
      expect(c).toHaveLength(NBA.length);
      for (const x of c) expect(contrast(x, background)).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < c.length; i++)
        for (let j = i + 1; j < c.length; j++)
          expect(
            deltaE(c[i] as string, c[j] as string),
            `${NBA[i]} vs ${NBA[j]} on ${background}`,
          ).toBeGreaterThanOrEqual(10);
    }
    setWarningHandler(null);
    expect(spy).not.toHaveBeenCalled();
  });

  test("dark mode: the Lakers and the Warriors no longer share one gold on #181a1b", async () => {
    await loadLeague("nba");
    const [lal, gs] = teamColorPalette("nba", ["LAL", "GS"], { background: "#181a1b" });
    expect(lal).not.toBe(gs);
    expect(deltaE(lal as string, gs as string)).toBeGreaterThanOrEqual(10);
  });

  test("no background (light default): the teams' own colours, unchanged", async () => {
    await loadLeague("nba");
    expect(teamColorPalette("nba", NBA)).toEqual(teamColorsSync("nba", NBA));
    expect(teamColorPalette("nba", NBA, { which: "secondary" })).toEqual(
      teamColorsSync("nba", NBA, { which: "secondary" }),
    );
  });
});
