import { surface } from "@sportsdataverse/sporty";
import { cleanup, configure, render, waitFor } from "@testing-library/svelte";
import { scaleBand } from "d3";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STANDINGS } from "../../../sdvtables/test/fixtures/standings.js";
import { InputError } from "../../src/errors.js";
import { HEADSHOT_ASPECT, headshotUrl } from "../../src/headshots.js";
import { getLeagueSync } from "../../src/index-data.js";
import {
  type League,
  contrast,
  loadLeague,
  logoUrlSync,
  resetWarnings,
  resolveSync,
  setWarningHandler,
  teamColorsSync,
} from "../../src/index.js";
import { HeadshotMark, LogoMark, SurfaceBackdrop, teamColorPalette } from "../../src/svelte/index.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE } from "../../src/team-palette.js";
import { drawnMarks } from "../../src/testing/index.js";
import Bump from "./fixtures/Bump.svelte";
import Host from "./fixtures/Host.svelte";

await loadLeague("nfl");
await loadLeague("nba");

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own
afterEach(() => {
  cleanup();
  setWarningHandler(null);
});
// The marks wait on a dynamic import of layerchart (an optional peer) before their first draw.
configure({ asyncUtilTimeout: 15_000 });
vi.setConfig({ testTimeout: 30_000 });

/** The AFC West's 2024 records (real: sdvtables' STANDINGS fixture), selected by team, not by position. */
const WEST = ["KC", "LAC", "DEN", "LV"].map(
  (t) => STANDINGS.find((s) => s.team === t) as (typeof STANDINGS)[0],
);
const ID = (t: string, league = "nfl") => resolveSync(t, league as "nfl") as string;
const URL_OF = (t: string, league = "nfl", o = {}) => logoUrlSync(t, league as "nfl", o) as string;
// Host's chart is 400 x 300 px with no padding; these domains make a point's pixel easy to state.
const AXES = { xDomain: [0, 500], yDomain: [0, 20] };
const px = (pf: number) => (pf / 500) * 400;
const py = (wins: number) => 300 - (wins / 20) * 300;

async function images(container: HTMLElement, n: number): Promise<Element[]> {
  return waitFor(() => {
    const found = Array.from(container.querySelectorAll("image[data-sdv-id]"));
    expect(found).toHaveLength(n);
    return found;
  });
}
const box = (img: Element) => ({
  x: Number(img.getAttribute("x")),
  y: Number(img.getAttribute("y")),
  width: Number(img.getAttribute("width")),
  height: Number(img.getAttribute("height")),
});

describe("LogoMark", () => {
  test("draws each row's team logo as an <image> in the chart's svg, centred on its scaled (x, y)", async () => {
    const { container } = render(Host, {
      chart: AXES,
      marks: [{ is: LogoMark, props: { data: WEST, x: "pf", y: "wins", team: "team", league: "nfl" } }],
    });
    const imgs = await images(container, 4);
    expect(imgs[0]?.closest("svg.lc-layout-svg")).not.toBeNull(); // inside LayerChart's <Svg> layer
    expect(imgs[0]?.namespaceURI).toBe("http://www.w3.org/2000/svg");
    for (const [i, s] of WEST.entries()) {
      const img = imgs[i] as Element;
      const b = box(img);
      expect(img.getAttribute("href")).toBe(URL_OF(s.team));
      expect(b.x + b.width / 2).toBeCloseTo(px(s.pf));
      expect(b.y + b.height / 2).toBeCloseTo(py(s.wins));
      expect(b.height).toBeCloseTo(0.1 * 300); // the default height: a tenth of the plot area
      expect(img.getAttribute("aria-label")).toBe(`${s.team} logo`);
    }
    // read back through sdvplot/testing: data coordinates, and the height as a fraction of the plot area
    expect(drawnMarks(container).map((m) => [m.id, m.x, m.y, m.url, m.kind])).toEqual(
      WEST.map((s) => [ID(s.team), s.pf, s.wins, URL_OF(s.team), "logo"]),
    );
  });

  test("height is a fraction of the plot height: drawnMarks reads it back unchanged (the size contract)", async () => {
    const { container } = render(Host, {
      chart: AXES,
      marks: [
        {
          is: LogoMark,
          props: { data: WEST.slice(0, 1), x: "pf", y: "wins", team: "team", league: "nfl", height: 0.25 },
        },
      ],
    });
    const [img] = await images(container, 1);
    expect(box(img as Element).height).toBeCloseTo(0.25 * 300);
    expect(drawnMarks(container).map((m) => m.height)).toEqual([0.25]);
  });

  test("a px height (the Recharts habit) or a bad alpha throws an InputError, naming the fraction", async () => {
    for (const bad of [{ height: 24 }, { height: 0 }, { alpha: 2 }]) {
      const onerror = vi.fn();
      render(Host, {
        chart: AXES,
        marks: [
          { is: LogoMark, props: { data: WEST, x: "pf", y: "wins", team: "team", league: "nfl", ...bad } },
        ],
        onerror,
      });
      await waitFor(() => expect(onerror).toHaveBeenCalledTimes(1));
      const e = onerror.mock.calls[0]?.[0] as Error;
      expect(e).toBeInstanceOf(InputError);
      expect(e.message).toMatch("height" in bad ? /fraction of the plot height/ : /alpha/);
      cleanup();
    }
  });

  test("a team with no logo draws nothing (no broken image) and warns once, as sdvplot/echarts does", async () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const rows = [...WEST.slice(0, 2), { team: "XXX", pf: 300, wins: 5 }];
    const { container } = render(Host, {
      chart: AXES,
      marks: [{ is: LogoMark, props: { data: rows, x: "pf", y: "wins", team: "team", league: "nfl" } }],
    });
    await images(container, 2);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/XXX/);
  });

  test("without data it marks the chart's own data; options: wordmark, alpha, a season column, embed", async () => {
    const embed = new Map([[URL_OF("KC", "nfl", { markType: "wordmark" }), "data:image/png;base64,AAAA"]]);
    const rows = WEST.map((s) => ({ ...s, season: 2024 }));
    const { container } = render(Host, {
      chart: { ...AXES, data: rows, x: "pf", y: "wins" },
      marks: [
        {
          is: LogoMark,
          props: {
            x: "pf",
            y: "wins",
            team: "team",
            league: "nfl",
            markType: "wordmark",
            alpha: 0.5,
            season: "season",
            embed,
          },
        },
      ],
    });
    const imgs = await images(container, 4);
    expect(imgs[0]?.getAttribute("href")).toBe("data:image/png;base64,AAAA");
    expect(imgs[1]?.getAttribute("href")).toBe(URL_OF("LAC", "nfl", { markType: "wordmark" }));
    expect(imgs[0]?.getAttribute("opacity")).toBe("0.5");
    expect(imgs[0]?.getAttribute("data-sdv-kind")).toBe("wordmark");
  });

  test("on a band scale the logo sits in the middle of the band", async () => {
    const { container } = render(Host, {
      chart: { xScale: scaleBand(), xDomain: WEST.map((s) => s.team), yDomain: [0, 20] },
      marks: [{ is: LogoMark, props: { data: WEST, x: "team", y: "wins", team: "team", league: "nfl" } }],
    });
    const imgs = await images(container, 4);
    const b = box(imgs[1] as Element); // LAC: the second of four 100 px bands
    expect(b.x + b.width / 2).toBeCloseTo(150);
  });
});

describe("HeadshotMark", () => {
  test("draws each row's ESPN headshot at its 600:436 aspect; an id with no headshot draws nothing and warns once", async () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const rows = [...WEST.slice(0, 2), { qb_espn_id: null, pf: 1, wins: 1 }];
    const { container } = render(Host, {
      chart: AXES,
      marks: [
        {
          is: HeadshotMark,
          props: { data: rows, x: "pf", y: "wins", player: "qb_espn_id", league: "nfl", height: 0.2 },
        },
      ],
    });
    const imgs = await images(container, 2);
    const b = box(imgs[0] as Element);
    expect(imgs[0]?.getAttribute("href")).toBe(headshotUrl(WEST[0]?.qb_espn_id as string, "nfl"));
    expect(b.height).toBeCloseTo(60);
    expect(b.width / b.height).toBeCloseTo(HEADSHOT_ASPECT);
    expect(b.x + b.width / 2).toBeCloseTo(px(WEST[0]?.pf as number));
    expect(imgs[0]?.getAttribute("data-sdv-kind")).toBe("headshot");
    expect(drawnMarks(container).map((m) => m.height)).toEqual([0.2, 0.2]);
    // a player id the headshot table does not know is skipped with one warning
    cleanup();
    render(Host, {
      chart: AXES,
      marks: [
        {
          is: HeadshotMark,
          props: { data: [{ id: "xx", pf: 1, wins: 1 }], x: "pf", y: "wins", player: "id", league: "wnba" },
        },
      ],
    });
    await waitFor(() => expect(spy).toHaveBeenCalled());
  });
});

describe("teamColorPalette and the chart", () => {
  // The AFC West's division rank after weeks 17 and 18 of 2024 (real: from nflverse games.csv via the standings).
  const ROWS = [
    { team: "KC", week: 17, rank: 1 },
    { team: "LAC", week: 17, rank: 2 },
    { team: "DEN", week: 17, rank: 3 },
    { team: "LV", week: 17, rank: 4 },
    { team: "KC", week: 18, rank: 1 },
    { team: "LAC", week: 18, rank: 2 },
    { team: "DEN", week: 18, rank: 3 },
    { team: "LV", week: 18, rank: 4 },
  ];
  const TEAMS = ["KC", "LAC", "DEN", "LV"];

  test("in a bump chart: each team's line in its team colour, its logo at the last week", async () => {
    const { container } = render(Bump, { rows: ROWS, teams: TEAMS });
    const imgs = await images(container, 4);
    const colors = teamColorsSync("nfl", TEAMS);
    for (const [i, team] of TEAMS.entries()) {
      const line = container.querySelector(`path[data-team="${team}"]`);
      expect(line?.getAttribute("stroke")).toBe(colors[i]);
      expect(imgs[i]?.getAttribute("href")).toBe(URL_OF(team));
      expect(imgs[i]?.getAttribute("data-sdv-x")).toBe("18");
    }
    // yDomain [4, 1]: rank 1 at the top
    expect(box(imgs[0] as Element).y).toBeLessThan(box(imgs[3] as Element).y);
  });

  test("the palette colours the teams the marks draw: rows by nickname, abbreviation or full name agree", async () => {
    const rows = [
      { team: "Lakers", x: 1, y: 1 },
      { team: "GS", x: 2, y: 2 },
      { team: "Boston Celtics", x: 3, y: 3 },
    ];
    const { container } = render(Host, {
      chart: { xDomain: [0, 4], yDomain: [0, 4] },
      marks: [{ is: LogoMark, props: { data: rows, x: "x", y: "y", team: "team", league: "nba" } }],
    });
    await images(container, 3);
    const ids = drawnMarks(container).map((m) => m.id);
    const raw = rows.map((r) => r.team);
    for (const o of [{}, { background: "#181a1b" }]) {
      const drawn = teamColorPalette("nba", ids, o);
      expect(drawn).toEqual(teamColorPalette("nba", raw, o));
      expect(new Set(drawn).size).toBe(3); // three real colours, not a shared fallback
    }
  });

  /** A league's teams in its standard (shard) order, by abbreviation. */
  const teamsOf = async (lg: League): Promise<string[]> => {
    await loadLeague(lg);
    return getLeagueSync(lg).teams.map((t) => t.abbr ?? t.team_id);
  };
  const BACKGROUNDS = ["#181a1b", "#000000", "#ffffff"] as const;

  test.each(["nba", "nfl", "mlb", "nhl"] as const)(
    "dark mode, %s in league order: every colour at 3:1 on each background, every pair at least MIN_DELTA_E apart, no warning",
    async (lg) => {
      const teams = await teamsOf(lg);
      const spy = vi.fn();
      setWarningHandler(spy);
      for (const bg of BACKGROUNDS) {
        const cs = teamColorPalette(lg, teams, { background: bg });
        expect(cs).toHaveLength(teams.length);
        for (const c of cs) expect(contrast(c, bg), `${c} on ${bg}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
        const close = cs.flatMap((c, i) =>
          cs
            .slice(0, i)
            .flatMap((p, j) => (deltaE(c, p) < MIN_DELTA_E ? [`${teams[j]}/${teams[i]} on ${bg}`] : [])),
        );
        expect(close).toEqual([]);
      }
      expect(spy).not.toHaveBeenCalled();
    },
  );

  test("no background (the light default): the teams' own colours, unchanged; an unresolved team takes the fallback", async () => {
    for (const lg of ["nba", "nfl", "mlb", "nhl"] as const) {
      const teams = await teamsOf(lg);
      expect(teamColorPalette(lg, teams)).toEqual(teamColorsSync(lg, teams).map((c) => c ?? "#808080"));
    }
    expect(teamColorPalette("nba", ["XXX"], { fallback: "#123456" })).toEqual(["#123456"]);
  });
});

describe("SurfaceBackdrop", () => {
  const court = surface("basketball", "nba", { displayRange: "defense" });
  const [x0, y0, x1, y1] = court.bbox;
  const sceneOf = (container: HTMLElement) =>
    waitFor(() => {
      const s = container.querySelector("g[data-sdv-surface] svg");
      expect(s).not.toBeNull();
      return s as Element;
    });

  test("paints the league's team-painted surface over the plot area, under the marks", async () => {
    const { container } = render(Host, {
      chart: { xDomain: [x0, x1], yDomain: [y0, y1] },
      marks: [
        { is: SurfaceBackdrop, props: { league: "nba", team: "DEN", displayRange: "defense" } },
        {
          is: LogoMark,
          props: { data: [{ team: "DEN", x: 0, y: 5.25 }], x: "x", y: "y", team: "team", league: "nba" },
        },
      ],
    });
    const scene = await sceneOf(container);
    // the domains are the scene's bbox, so the surface fills the 400 x 300 plot area exactly
    expect(Number(scene.getAttribute("x"))).toBeCloseTo(0);
    expect(Number(scene.getAttribute("y"))).toBeCloseTo(0);
    expect(Number(scene.getAttribute("width"))).toBeCloseTo(400);
    expect(Number(scene.getAttribute("height"))).toBeCloseTo(300);
    expect(scene.getAttribute("preserveAspectRatio")).toBe("none");
    expect(scene.innerHTML).toContain("<path");
    const den = teamColorsSync("nba", ["DEN"])[0] as string;
    expect(scene.innerHTML.toLowerCase()).toContain(`fill="${den.toLowerCase()}"`);
    await images(container, 1);
    const all = Array.from(container.querySelectorAll("g[data-sdv-surface], image[data-sdv-id]"));
    expect(all[0]?.hasAttribute("data-sdv-surface")).toBe(true); // drawn first, so under the logo
  });

  test("a domain wider than the surface maps the bbox into data coordinates, clipped to the plot area", async () => {
    const w = x1 - x0;
    const { container } = render(Host, {
      chart: { xDomain: [x0 - w / 2, x1 + w / 2], yDomain: [y0, y1] },
      marks: [{ is: SurfaceBackdrop, props: { league: "nba", displayRange: "defense" } }],
    });
    const scene = await sceneOf(container);
    expect(Number(scene.getAttribute("width"))).toBeCloseTo(200);
    expect(Number(scene.getAttribute("x"))).toBeCloseTo(100);
    expect(container.querySelector("g[data-sdv-surface] clipPath rect")?.getAttribute("width")).toBe("400");
  });

  test("a reversed axis or a band scale draws no surface and warns once, rather than a mirrored court", async () => {
    for (const [chart, message] of [
      [{ xDomain: [x0, x1], yDomain: [y0, y1], xReverse: true }, /reversed or log/],
      [{ xScale: scaleBand(), xDomain: ["a", "b"], yDomain: [y0, y1] }, /numeric/],
    ] as const) {
      resetWarnings();
      const spy = vi.fn();
      setWarningHandler(spy);
      const { container } = render(Host, {
        chart,
        marks: [{ is: SurfaceBackdrop, props: { league: "nba", displayRange: "defense" } }],
      });
      await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
      expect(String(spy.mock.calls[0]?.[0])).toMatch(message);
      expect(container.querySelector("g[data-sdv-surface]")).toBeNull();
      cleanup();
    }
  });
});
