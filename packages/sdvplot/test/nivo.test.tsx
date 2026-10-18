// @vitest-environment jsdom
import { Bump, type BumpCustomLayerProps, type BumpDatum } from "@nivo/bump";
import { Chord, type CustomLayerProps as ChordLayerProps } from "@nivo/chord";
import { SwarmPlot, type SwarmPlotCustomLayerProps } from "@nivo/swarmplot";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InputError, UnsupportedTargetError } from "../src/errors.js";
import { getLeagueSync } from "../src/index-data.js";
import {
  contrast,
  hex6,
  loadLeague,
  logoUrlSync,
  resetWarnings,
  resolveSync,
  setWarningHandler,
  teamColorsSync,
} from "../src/index.js";
import { logoLayer, logoNode, teamColors } from "../src/nivo.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE } from "../src/team-palette.js";
import { drawnMarks } from "../src/testing/index.js";
import { BUF, KC } from "./_fixtures.js";

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own
afterEach(cleanup);

const ID = (t: string) => resolveSync(t, "nfl") as string;
const URL_OF = (t: string, o = {}) => logoUrlSync(t, "nfl", o) as string;
/** nivo writes a line's colour as `rgba(r, g, b, 1)`. */
const rgba = (hex: string) => {
  const h = hex6(hex);
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, 1)`;
};
const centre = (img: Element) => ({
  x: Number(img.getAttribute("x")) + Number(img.getAttribute("width")) / 2,
  y: Number(img.getAttribute("y")) + Number(img.getAttribute("height")) / 2,
  h: Number(img.getAttribute("height")),
});
const images = (c: Element) => [...c.querySelectorAll("image")];

type Week = BumpDatum & { x: number };
/** Two teams' ranks over three weeks; Kansas City has no rank in week 3 (a bye), so its last point is week 2. */
const SERIES = [
  {
    id: KC,
    data: [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: null },
    ] as Week[],
  },
  {
    id: BUF,
    data: [
      { x: 1, y: 2 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ] as Week[],
  },
];
/** A Bump with a layer that records what nivo hands custom layers, so the test reads the positions it computed. */
function bump(layer: unknown, data: readonly { id: string; data: Week[] }[] = SERIES, extra = {}) {
  const seen: { props?: BumpCustomLayerProps<Week, Record<string, unknown>> } = {};
  const probe = (p: BumpCustomLayerProps<Week, Record<string, unknown>>) => {
    seen.props = p;
    return null;
  };
  const r = render(
    <Bump<Week>
      width={400}
      height={300}
      animate={false}
      data={data as { id: string; data: Week[] }[]}
      // biome-ignore lint/suspicious/noExplicitAny: the layer under test is typed structurally
      layers={["lines", "points", probe, layer as any]}
      {...extra}
    />,
  );
  return { container: r.container, props: seen.props as BumpCustomLayerProps<Week, Record<string, unknown>> };
}

describe("logoLayer on a Bump", () => {
  test("one logo per series at its last point, centred where nivo put the point, height x innerHeight tall", () => {
    const { container, props } = bump(logoLayer({ league: "nfl", height: 0.1 }));
    const last = (id: string) => props.points.filter((p) => p.serie.id === id).at(-1);
    const imgs = images(container);
    expect(imgs.map((i) => i.getAttribute("href"))).toEqual([URL_OF(KC), URL_OF(BUF)]);
    for (const [img, id] of [
      [imgs[0], KC],
      [imgs[1], BUF],
    ] as const) {
      const c = centre(img as Element);
      expect(c.x).toBeCloseTo(last(id)?.x as number);
      expect(c.y).toBeCloseTo(last(id)?.y as number);
      expect(c.h).toBeCloseTo(0.1 * props.innerHeight);
    }
    expect(last(KC)?.data.x).toBe(2); // the bye: its last point is week 2, not 3
    expect(imgs[0]?.getAttribute("aria-label")).toBe("KC logo");
    expect(drawnMarks(container).map((m) => [m.id, m.url, m.kind])).toEqual([
      [ID(KC), URL_OF(KC), "logo"],
      [ID(BUF), URL_OF(BUF), "logo"],
    ]);
  });

  test("the size contract: height is a fraction of the plot height, read back as that fraction", () => {
    const { container, props } = bump(logoLayer({ league: "nfl", height: 0.25 }));
    expect(drawnMarks(container).map((m) => m.height)).toEqual([0.25, 0.25]);
    expect(centre(images(container)[0] as Element).h).toBeCloseTo(0.25 * props.innerHeight);
  });

  test("nivo hands the layer innerHeight, so a px size is the wrong kind: it throws, naming the mistake", () => {
    for (const height of [24, 1.5, 0, Number.NaN])
      expect(() => logoLayer({ league: "nfl", height })).toThrow(/height is a fraction of the plot height/);
    expect(() => logoLayer({ league: "nfl", height: 1 })).not.toThrow();
    expect(() => logoLayer({ league: "nfl", alpha: 2 })).toThrow(InputError);
    // biome-ignore lint/suspicious/noExplicitAny: an invalid value on purpose
    expect(() => logoLayer({ league: "nfl", at: "middle" as any })).toThrow(/at must be/);
  });

  test('at: "first" and "all"', () => {
    const first = bump(logoLayer({ league: "nfl", at: "first" }));
    expect(images(first.container).map((i) => Math.round(centre(i).x))).toEqual(
      [KC, BUF].map((id) => Math.round(first.props.points.find((p) => p.serie.id === id)?.x as number)),
    );
    cleanup();
    const all = bump(logoLayer({ league: "nfl", at: "all" }));
    expect(images(all.container)).toHaveLength(all.props.points.length); // 5: the bye has no point
  });

  test("a team with no logo draws nothing (no broken image) and warns once, as sdvplot/echarts does", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const data = [SERIES[0] as (typeof SERIES)[0], { id: "XXX", data: SERIES[1]?.data as Week[] }];
    const { container } = bump(logoLayer({ league: "nfl" }), data);
    expect(drawnMarks(container).map((m) => m.id)).toEqual([ID(KC)]);
    // a re-render (nivo re-renders its layers on hover) does not warn again
    cleanup();
    bump(logoLayer({ league: "nfl" }), data);
    setWarningHandler(null);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatch(/XXX/);
  });

  test("team: a series field holding the team; season column, variant, alpha, wordmark, embed", () => {
    const data = [{ id: "Kansas City", club: KC, season: 2024, data: SERIES[0]?.data as Week[] }];
    const embed = new Map([[URL_OF(KC, { markType: "wordmark" }), "data:image/png;base64,AAAA"]]);
    const { container } = bump(
      logoLayer({ league: "nfl", team: "club", season: "season", alpha: 0.5, markType: "wordmark", embed }),
      data,
    );
    const img = images(container)[0] as Element;
    expect(img.getAttribute("href")).toBe("data:image/png;base64,AAAA");
    expect(img.getAttribute("opacity")).toBe("0.5");
    expect(drawnMarks(container).map((m) => [m.id, m.kind])).toEqual([[ID(KC), "wordmark"]]);
  });

  test("a layer that is not a Bump, SwarmPlot or Chord layer throws UnsupportedTargetError", () => {
    const layer = logoLayer({ league: "nfl" });
    expect(() => layer({ innerHeight: 100 })).toThrow(UnsupportedTargetError);
  });
});

describe("logoLayer on a SwarmPlot and a Chord", () => {
  const ROWS = [
    { team: KC, pf: 385, group: "AFC" },
    { team: BUF, pf: 525, group: "AFC" },
  ];
  test("SwarmPlot: one logo per node at the node's position, the team read from the datum", () => {
    const seen: { props?: Pick<SwarmPlotCustomLayerProps<unknown>, "nodes" | "innerHeight"> } = {};
    const { container } = render(
      <SwarmPlot<(typeof ROWS)[0]>
        width={400}
        height={300}
        animate={false}
        data={ROWS}
        groups={["AFC"]}
        id="team"
        value="pf"
        size={20}
        layers={[
          "circles",
          (p) => {
            seen.props = p;
            return null;
          },
          logoLayer({ league: "nfl", team: "team", height: 0.1 }),
        ]}
      />,
    );
    const nodes = seen.props?.nodes ?? [];
    expect(drawnMarks(container).map((m) => m.id)).toEqual([ID(KC), ID(BUF)]);
    images(container).forEach((img, i) => {
      expect(centre(img).x).toBeCloseTo(nodes[i]?.x as number);
      expect(centre(img).y).toBeCloseTo(nodes[i]?.y as number);
      expect(centre(img).h).toBeCloseTo(0.1 * (seen.props?.innerHeight as number));
    });
  });

  test("Chord: one logo per arc, outside the ring at the arc's middle angle", () => {
    const seen: { props?: ChordLayerProps } = {};
    const { container } = render(
      <Chord
        width={400}
        height={300}
        animate={false}
        keys={[KC, BUF]}
        data={[
          [0, 2],
          [3, 0],
        ]}
        layers={[
          "arcs",
          (p) => {
            seen.props = p;
            return null;
          },
          logoLayer({ league: "nfl", height: 0.1 }),
        ]}
      />,
    );
    const p = seen.props as ChordLayerProps;
    const [cx, cy] = p.center;
    const h = 0.1 * 2 * cy; // the chord's plot height: nivo centres it
    images(container).forEach((img, i) => {
      const arc = p.arcs[i] as ChordLayerProps["arcs"][0];
      const a = (arc.startAngle + arc.endAngle) / 2;
      const r = p.radius + h / 2 + 4;
      expect(centre(img).x).toBeCloseTo(cx + r * Math.sin(a));
      expect(centre(img).y).toBeCloseTo(cy - r * Math.cos(a));
      expect(centre(img).h).toBeCloseTo(h);
    });
    expect(drawnMarks(container).map((m) => [m.id, m.height])).toEqual([
      [ID(KC), 0.1],
      [ID(BUF), 0.1],
    ]);
  });
});

describe("logoNode", () => {
  test("SwarmPlot circleComponent: each node is its team's logo, as tall as nivo sized the node", () => {
    const rows = [
      { team: KC, pf: 385, group: "AFC" },
      { team: BUF, pf: 525, group: "AFC" },
    ];
    const seen: { nodes?: readonly { x: number; y: number; size: number }[] } = {};
    const { container } = render(
      <SwarmPlot<(typeof rows)[0]>
        width={400}
        height={300}
        animate={false}
        data={rows}
        groups={["AFC"]}
        id="team"
        value="pf"
        size={30}
        circleComponent={logoNode({ league: "nfl", team: "team" })}
        layers={[
          "circles",
          (p) => {
            seen.nodes = p.nodes;
            return null;
          },
        ]}
      />,
    );
    const imgs = images(container);
    expect(imgs.map((i) => i.getAttribute("href"))).toEqual([URL_OF(KC), URL_OF(BUF)]);
    imgs.forEach((img, i) => {
      expect(centre(img).x).toBeCloseTo(seen.nodes?.[i]?.x as number);
      expect(centre(img).y).toBeCloseTo(seen.nodes?.[i]?.y as number);
      expect(centre(img).h).toBe(30);
    });
    // the px contract: a node component gets no plot height, so drawnMarks' height is the node size in px
    expect(drawnMarks(container).map((m) => m.height)).toEqual([30, 30]);
    expect(container.querySelectorAll("circle")).toHaveLength(0); // the logo replaces the circle
  });

  test("Bump pointComponent: every point is the series' logo", () => {
    const { container, props } = bump(null, SERIES, {
      pointSize: 16,
      pointComponent: logoNode({ league: "nfl" }),
      layers: ["lines", "points"],
    });
    expect(props).toBeUndefined(); // no probe: the layers were replaced
    expect(drawnMarks(container).map((m) => [m.id, m.height])).toEqual([
      [ID(KC), 16],
      [ID(KC), 16],
      [ID(BUF), 16],
      [ID(BUF), 16],
      [ID(BUF), 16],
    ]);
  });

  test("a node with no logo draws nothing and warns once; bad alpha or a height throws", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const node = logoNode({ league: "nfl", team: "team" });
    const a = render(
      <svg role="img" aria-label="t">
        {node({ node: { id: "a", x: 1, y: 2, size: 10, data: { team: "XXX" } } })}
        {node({ node: { id: "b", x: 3, y: 4, size: 10, data: { team: "XXX" } } })}
      </svg>,
    );
    setWarningHandler(null);
    expect(images(a.container)).toHaveLength(0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(() => logoNode({ league: "nfl", alpha: -1 })).toThrow(InputError);
    // the layer's habit: a node logo is the node's own size, so a height (fraction or px) is refused, naming why
    // (cast: an option logoNode does not take, as JS would pass it)
    for (const height of [0.1, 24])
      expect(() => logoNode({ league: "nfl", height } as never)).toThrow(
        /logoNode takes no height.*node.*px/,
      );
  });
});

describe("teamColors", () => {
  test("a Bump's lines are drawn in the series' team colours", () => {
    const { container } = bump(null, SERIES, { colors: teamColors({ league: "nfl" }), layers: ["lines"] });
    const strokes = [KC, BUF].map((id) =>
      container.querySelector(`[data-testid="line.${id}"]`)?.getAttribute("stroke"),
    );
    expect(strokes).toEqual(teamColorsSync("nfl", [KC, BUF]).map((c) => rgba(c as string)));
  });

  test("a SwarmPlot's nodes by the datum's team (by), a Chord's arcs by id; an unresolved team takes the fallback", () => {
    const by = teamColors({ league: "nfl", by: "team", fallback: "#999999" });
    expect(by({ id: "n1", data: { team: KC } })).toBe(teamColorsSync("nfl", [KC])[0]);
    expect(by({ id: "n2", data: { team: "XXX" } })).toBe("#999999");
    const { container } = render(
      <Chord
        width={300}
        height={300}
        animate={false}
        keys={[KC, BUF]}
        data={[
          [0, 2],
          [3, 0],
        ]}
        colors={teamColors({ league: "nfl" })}
        layers={["arcs"]}
      />,
    );
    expect(
      [KC, BUF].map((id) => container.querySelector(`[data-testid="arc.${id}"]`)?.getAttribute("fill")),
    ).toEqual(teamColorsSync("nfl", [KC, BUF])); // nivo writes an arc's fill as given
  });

  test("background needs the whole set of teams (the palette keeps them distinct from each other)", () => {
    expect(() => teamColors({ league: "nfl", background: "#181a1b" })).toThrow(/teams/);
    const spy = vi.fn();
    setWarningHandler(spy);
    const c = teamColors({ league: "nfl", teams: [KC, BUF], background: "#181a1b", fallback: "#888888" });
    expect(c({ id: "LV" })).toBe("#888888"); // not in teams: the fallback, with one warning
    c({ id: "LV" });
    setWarningHandler(null);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("resolves teams as the drawn marks do: the colour of each mark's team id is the colour of its row value", async () => {
    await loadLeague("nba");
    const rows = [{ team: "Clippers" }, { team: "PHX" }, { team: "Los Angeles Lakers" }];
    const node = logoNode({ league: "nba", team: "team" });
    const { container } = render(
      <svg role="img" aria-label="t">
        {rows.map((r, i) => (
          <g key={r.team}>{node({ node: { id: r.team, x: i, y: i, size: 10, data: r } })}</g>
        ))}
      </svg>,
    );
    const ids = drawnMarks(container).map((m) => m.id);
    expect(ids).toHaveLength(3);
    const values = rows.map((r) => r.team);
    for (const o of [{}, { teams: values, background: "#181a1b" }]) {
      const c = teamColors({ league: "nba", ...o });
      const byValue = values.map((id) => c({ id }));
      expect(ids.map((id) => c({ id }))).toEqual(byValue);
      expect(new Set(byValue).size).toBe(3); // three teams, three colours: not three fallbacks
    }
  });

  const LEAGUES = ["nba", "nfl", "mlb", "nhl"] as const;
  /** A league's team ids in its standard (shard) order. */
  const ids = (lg: (typeof LEAGUES)[number]) => getLeagueSync(lg).teams.map((t) => t.team_id);

  test.each(LEAGUES.flatMap((lg) => ["#181a1b", "#000000", "#ffffff"].map((bg) => [lg, bg] as const)))(
    "dark mode: %s in league order on %s, every colour reads (3:1) and every pair is MIN_DELTA_E apart, no warning",
    async (lg, background) => {
      await loadLeague(lg);
      const teams = ids(lg);
      const spy = vi.fn();
      setWarningHandler(spy);
      const get = teamColors({ league: lg, teams, background, idSystem: "team_id" });
      const c = teams.map((id) => get({ id }));
      setWarningHandler(null);
      expect(spy).not.toHaveBeenCalled();
      for (const x of c) expect(contrast(x, background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      const close = c.flatMap((x, i) =>
        c.slice(0, i).flatMap((p, j) => (deltaE(x, p) < MIN_DELTA_E ? [`${teams[j]}/${teams[i]}`] : [])),
      );
      expect(close).toEqual([]);
    },
  );

  test("dark mode: the Lakers and the Warriors no longer share one gold on #181a1b", async () => {
    await loadLeague("nba");
    const get = teamColors({ league: "nba", teams: ["LAL", "GS"], background: "#181a1b" });
    expect(deltaE(get({ id: "LAL" }), get({ id: "GS" }))).toBeGreaterThanOrEqual(MIN_DELTA_E);
  });

  test("no background (light default): the teams' own colours, unchanged", async () => {
    for (const lg of LEAGUES) {
      await loadLeague(lg);
      const teams = ids(lg);
      const get = teamColors({ league: lg, idSystem: "team_id" });
      expect(teams.map((id) => get({ id }))).toEqual(teamColorsSync(lg, teams, { idSystem: "team_id" }));
      const sec = teamColors({ league: lg, which: "secondary", idSystem: "team_id" });
      expect(teams.map((id) => sec({ id }))).toEqual(
        teamColorsSync(lg, teams, { which: "secondary", idSystem: "team_id" }),
      );
    }
  });
});
