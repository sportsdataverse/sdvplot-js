// @vitest-environment jsdom
import { cleanup, configure, render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  VictoryAxis,
  VictoryBar,
  VictoryChart,
  VictoryGroup,
  VictoryLine,
  VictoryScatter,
  VictoryTheme,
} from "victory";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InputError, UnsupportedTargetError } from "../src/errors.js";
import { getLeagueSync } from "../src/index-data.js";
import {
  type League,
  contrast,
  hex6,
  loadLeague,
  logoUrlSync,
  resetWarnings,
  resolveSync,
  setWarningHandler,
  teamColorsSync,
} from "../src/index.js";
import { LogoPoint, LogoTick } from "../src/react/index.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE } from "../src/team-palette.js";
import { drawnMarks } from "../src/testing/index.js";
import { teamColorPalette, teamTheme } from "../src/victory.js";
import { BUF, KC } from "./_fixtures.js";

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own
afterEach(cleanup);
// LogoTick's text fallback (VictoryLabel) is a lazy import: give its first load time on a busy machine.
configure({ asyncUtilTimeout: 15_000 });
vi.setConfig({ testTimeout: 20_000 });

const ID = (t: string) => resolveSync(t, "nfl") as string;
const URL_OF = (t: string) => logoUrlSync(t, "nfl") as string;
const box = (img: Element) => {
  const [x, y, w, h] = ["x", "y", "width", "height"].map((a) => Number(img.getAttribute(a))) as [
    number,
    number,
    number,
    number,
  ];
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
};
const images = (c: Element) => [...c.querySelectorAll("image")];
/** Victory writes a colour into an inline style; jsdom may hand it back as rgb(). */
const hexOf = (v: string) => {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(v);
  return m === null
    ? hex6(v)
    : `#${m
        .slice(1, 4)
        .map((n) => Number(n).toString(16).padStart(2, "0"))
        .join("")}`;
};

const ROW = { team: KC, pf: 385, pa: 326 };
const ROWS = [ROW, { team: BUF, pf: 525, pa: 368 }];
/** Records what Victory hands a component it clones (a scatter's `dataComponent`, an axis' `tickLabelComponent`). */
function probe(): { seen: Record<string, unknown>[]; el: ReactElement } {
  const seen: Record<string, unknown>[] = [];
  const Probe = (p: Record<string, unknown>) => {
    seen.push(p);
    return null;
  };
  return { seen, el: <Probe /> };
}
const scatter = (dataComponent: ReactElement, size = 12) => (
  <VictoryChart width={400} height={300} domainPadding={30} animate={false}>
    <VictoryScatter data={ROWS} x="pf" y="pa" size={size} dataComponent={dataComponent} />
  </VictoryChart>
);

describe("LogoPoint (a VictoryScatter dataComponent)", () => {
  test("each logo is centred on the point Victory computed, as tall as the point it replaces (2 x size px)", () => {
    const p = probe();
    render(scatter(p.el));
    const { container } = render(scatter(<LogoPoint league="nfl" team="team" />));
    const imgs = images(container);
    expect(imgs.map((i) => i.getAttribute("href"))).toEqual([URL_OF(KC), URL_OF(BUF)]);
    imgs.forEach((img, i) => {
      const b = box(img);
      expect(b.cx).toBeCloseTo(p.seen[i]?.x as number, 6);
      expect(b.cy).toBeCloseTo(p.seen[i]?.y as number, 6);
      expect(b.h).toBe(2 * (p.seen[i]?.size as number));
    });
    expect(container.querySelectorAll("path")).toHaveLength(0); // the logos replace Victory's point symbols
    expect(imgs[0]?.getAttribute("aria-label")).toMatch(/logo$/);
  });

  test("the size contract: drawnMarks reads the logo's px height back (a dataComponent gets no plot height)", () => {
    const { container } = render(scatter(<LogoPoint league="nfl" team="team" />, 15));
    const marks = drawnMarks(container);
    expect(marks.map((m) => m.id)).toEqual([ID(KC), ID(BUF)]);
    expect(marks.map((m) => m.height)).toEqual([30, 30]);
    expect(marks.map((m) => m.kind)).toEqual(["logo", "logo"]);
  });

  test("takes no height: a fraction of the plot (the spec adapters' `height`) is refused", () => {
    for (const height of [0.1, 24])
      expect(() =>
        LogoPoint({
          league: "nfl",
          team: "team",
          ...({ height } as object),
          x: 1,
          y: 1,
          size: 5,
          datum: ROW,
        }),
      ).toThrow(InputError);
    expect(() => LogoPoint({ league: "nfl", team: "team", x: 1, y: 1, size: 5, datum: ROW })).not.toThrow();
  });

  test("outside a scatter (no point position or size) it throws UnsupportedTargetError", () => {
    expect(() => LogoPoint({ league: "nfl", team: "team", datum: ROW })).toThrow(UnsupportedTargetError);
  });

  test("a team with no logo draws nothing and warns once, across re-renders", () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const rows = [
      { team: "XXX", pf: 1, pa: 1 },
      { team: KC, pf: 2, pa: 2 },
    ];
    const chart = (
      <VictoryChart width={300} height={200} animate={false}>
        <VictoryScatter
          data={rows}
          x="pf"
          y="pa"
          size={10}
          dataComponent={<LogoPoint league="nfl" team="team" />}
        />
      </VictoryChart>
    );
    const { container, rerender } = render(chart);
    rerender(chart);
    setWarningHandler(null);
    expect(drawnMarks(container).map((m) => m.id)).toEqual([ID(KC)]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/XXX/);
  });

  test("options: a season column, a wordmark, alpha, embed and Victory's events", () => {
    const onClick = vi.fn();
    const datum = { team: KC, yr: 2024 };
    const url = logoUrlSync(KC, "nfl", { markType: "wordmark", season: 2024 }) as string;
    const embed = new Map([[url, "data:image/png;base64,AAAA"]]);
    const { container } = render(
      <svg role="img" aria-label="t">
        <LogoPoint
          league="nfl"
          team="team"
          season="yr"
          markType="wordmark"
          alpha={0.5}
          embed={embed}
          x={10}
          y={20}
          size={8}
          datum={datum}
          events={{ onClick }}
        />
      </svg>,
    );
    const img = images(container)[0] as Element;
    expect(img.getAttribute("href")).toBe("data:image/png;base64,AAAA");
    expect(img.getAttribute("data-sdv-kind")).toBe("wordmark");
    expect(img.getAttribute("opacity")).toBe("0.5");
    (img as SVGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(() => LogoPoint({ league: "nfl", team: "team", alpha: 2, x: 1, y: 1, size: 5, datum })).toThrow(
      InputError,
    );
  });
});

describe("LogoTick (an axis' tickLabelComponent)", () => {
  const bars = (tick: ReactElement, horizontal = false) => (
    <VictoryChart width={400} height={300} domainPadding={30} horizontal={horizontal} animate={false}>
      <VictoryAxis tickLabelComponent={tick} />
      <VictoryAxis dependentAxis />
      <VictoryBar data={ROWS} x="team" y="pf" />
    </VictoryChart>
  );

  test("bottom axis: each logo hangs from Victory's label anchor, centred on the tick", () => {
    const p = probe();
    render(bars(p.el));
    const { container } = render(bars(<LogoTick league="nfl" size={30} />));
    const imgs = images(container);
    expect(imgs.map((i) => i.getAttribute("href"))).toEqual([URL_OF(KC), URL_OF(BUF)]);
    imgs.forEach((img, i) => {
      expect(p.seen[i]).toMatchObject({ textAnchor: "middle", verticalAnchor: "start" });
      const b = box(img);
      expect(b.cx).toBeCloseTo(p.seen[i]?.x as number, 6);
      expect(b.y).toBeCloseTo(p.seen[i]?.y as number, 6);
      expect(b.h).toBe(30);
    });
    expect(drawnMarks(container).map((m) => m.height)).toEqual([30, 30]); // px
  });

  test("left axis (a horizontal chart): each logo ends at the label anchor, centred on the tick", () => {
    const p = probe();
    render(bars(p.el, true));
    const { container } = render(bars(<LogoTick league="nfl" />, true));
    images(container).forEach((img, i) => {
      expect(p.seen[i]).toMatchObject({ textAnchor: "end", verticalAnchor: "middle" });
      const b = box(img);
      expect(b.x + b.w).toBeCloseTo(p.seen[i]?.x as number, 6);
      expect(b.cy).toBeCloseTo(p.seen[i]?.y as number, 6);
      expect(b.h).toBe(24); // the default
    });
  });

  test("top and right axes: the logo sits above, or right of, Victory's label anchor", () => {
    const chart = (tick: ReactElement, orientation: "top" | "right") => (
      <VictoryChart
        width={400}
        height={300}
        domainPadding={30}
        horizontal={orientation === "right"}
        animate={false}
      >
        <VictoryAxis orientation={orientation} tickLabelComponent={tick} />
        <VictoryBar data={ROWS} x="team" y="pf" />
      </VictoryChart>
    );
    for (const [orientation, anchors] of [
      ["top", { textAnchor: "middle", verticalAnchor: "end" }],
      ["right", { textAnchor: "start", verticalAnchor: "middle" }],
    ] as const) {
      const p = probe();
      render(chart(p.el, orientation));
      const { container } = render(chart(<LogoTick league="nfl" />, orientation));
      const imgs = images(container);
      expect(imgs).toHaveLength(2);
      imgs.forEach((img, i) => {
        expect(p.seen[i], orientation).toMatchObject(anchors);
        const b = box(img);
        if (orientation === "top") {
          expect(b.cx).toBeCloseTo(p.seen[i]?.x as number, 6);
          expect(b.y + b.h).toBeCloseTo(p.seen[i]?.y as number, 6);
        } else {
          expect(b.x).toBeCloseTo(p.seen[i]?.x as number, 6);
          expect(b.cy).toBeCloseTo(p.seen[i]?.y as number, 6);
        }
      });
      cleanup();
    }
  });

  test("size is px, 1 or more; a height (a fraction of the plot) is refused", () => {
    for (const size of [0.5, 0, Number.NaN])
      expect(() => LogoTick({ league: "nfl", size, text: KC, x: 0, y: 0 })).toThrow(InputError);
    expect(() => LogoTick({ league: "nfl", ...({ height: 0.1 } as object), text: KC, x: 0, y: 0 })).toThrow(
      /takes no height/,
    );
    expect(() => LogoTick({ league: "nfl", size: 1, text: KC, x: 0, y: 0 })).not.toThrow();
  });

  test("a category with no logo keeps its text label, drawn by Victory's own VictoryLabel, and warns once", async () => {
    const spy = vi.fn();
    setWarningHandler(spy);
    const { container } = render(
      <VictoryChart width={400} height={300} domainPadding={30} animate={false}>
        <VictoryAxis tickLabelComponent={<LogoTick league="nfl" />} />
        <VictoryBar
          data={[
            { team: "XXX", pf: 1 },
            { team: KC, pf: 2 },
          ]}
          x="team"
          y="pf"
        />
      </VictoryChart>,
    );
    await waitFor(() => expect(container.querySelector("text tspan")?.textContent).toBe("XXX"));
    setWarningHandler(null);
    expect(drawnMarks(container).map((m) => m.id)).toEqual([ID(KC)]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("teamColorPalette and teamTheme", () => {
  test("teamColorPalette: one colour per team, a VictoryGroup's colorScale, with a fallback", async () => {
    expect(teamColorPalette("nfl", [KC, BUF])).toEqual(teamColorsSync("nfl", [KC, BUF]));
    const spy = vi.fn();
    setWarningHandler(spy);
    expect(teamColorPalette("nfl", [KC, "XXX"], { fallback: "#123456" })[1]).toBe("#123456");
    setWarningHandler(null);
    expect(spy).toHaveBeenCalledTimes(1); // XXX is no team
    expect(teamColorPalette("nfl", [KC], { which: "secondary" })).toEqual(
      teamColorsSync("nfl", [KC], { which: "secondary" }),
    );
  });

  test("teamTheme: the palette as every colorScale, its first colour for a lone series, over a base theme", () => {
    const teams = [KC, BUF];
    const pal = teamColorPalette("nfl", teams, { background: "#181a1b" });
    const t = teamTheme({ league: "nfl", teams, background: "#181a1b", base: VictoryTheme.clean });
    for (const k of ["group", "stack", "pie", "legend"] as const) expect(t[k]?.colorScale).toEqual(pal);
    expect(t.line?.style?.data?.stroke).toBe(pal[0]);
    expect(t.scatter?.style?.data?.fill).toBe(pal[0]);
    expect(t.bar?.style?.data?.fill).toBe(pal[0]);
    expect(t.area?.style?.data?.fill).toBe(pal[0]);
    // the base's other keys and styles are kept
    expect(t.axis).toBe(VictoryTheme.clean.axis);
    expect(t.line?.style?.labels).toEqual(VictoryTheme.clean.line?.style?.labels);
    expect(t.line?.style?.data?.strokeWidth).toBe(VictoryTheme.clean.line?.style?.data?.strokeWidth);
    expect(teamTheme({ league: "nfl", teams }).group?.colorScale).toEqual(teamColorsSync("nfl", teams));
  });

  test("a VictoryGroup under teamTheme draws each line in its team's palette colour", () => {
    const teams = [KC, BUF, "DEN"];
    const pal = teamColorPalette("nfl", teams, { background: "#181a1b" });
    const { container } = render(
      <VictoryChart theme={teamTheme({ league: "nfl", teams, background: "#181a1b" })} animate={false}>
        <VictoryGroup>
          {teams.map((t, i) => (
            <VictoryLine
              key={t}
              data={[
                { x: 1, y: i },
                { x: 2, y: i + 1 },
              ]}
            />
          ))}
        </VictoryGroup>
      </VictoryChart>,
    );
    const strokes = [...container.querySelectorAll("path")].map((p) =>
      hexOf((p as SVGElement).style.stroke as string),
    );
    expect(strokes).toEqual(pal);
  });

  test("resolves teams as the drawn marks do: the colour of each mark's team id is the colour of its row value", async () => {
    await loadLeague("nba");
    const rows = [{ team: "Clippers" }, { team: "PHX" }, { team: "Los Angeles Lakers" }];
    const { container } = render(
      <svg role="img" aria-label="t">
        {rows.map((r, i) => (
          <LogoPoint key={r.team} league="nba" team="team" x={i} y={i} size={5} datum={r} />
        ))}
      </svg>,
    );
    const ids = drawnMarks(container).map((m) => m.id);
    expect(ids).toHaveLength(3);
    const values = rows.map((r) => r.team);
    for (const o of [{}, { background: "#181a1b" }]) {
      const byValue = teamColorPalette("nba", values, o);
      expect(teamColorPalette("nba", ids, o)).toEqual(byValue);
      expect(new Set(byValue).size).toBe(3); // three teams, three colours: not three fallbacks
      expect(teamTheme({ league: "nba", teams: ids, ...o }).group?.colorScale).toEqual(byValue);
    }
  });

  const LEAGUES = ["nba", "nfl", "mlb", "nhl"] as const;
  /** A league's team ids in its standard (shard) order. */
  const ids = async (lg: League) => {
    await loadLeague(lg);
    return getLeagueSync(lg).teams.map((t) => t.team_id);
  };

  test.each(LEAGUES.flatMap((lg) => ["#181a1b", "#000000", "#ffffff"].map((bg) => [lg, bg] as const)))(
    "dark mode, %s in league order on %s: every colour reads (MIN_CONTRAST) and every pair is MIN_DELTA_E apart, no warning",
    async (lg, background) => {
      const teams = await ids(lg);
      const spy = vi.fn();
      setWarningHandler(spy);
      const c = teamColorPalette(lg, teams, { background, idSystem: "team_id" });
      setWarningHandler(null);
      expect(spy).not.toHaveBeenCalled();
      expect(c).toHaveLength(teams.length);
      for (const x of c) expect(contrast(x, background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      for (let i = 0; i < c.length; i++)
        for (let j = i + 1; j < c.length; j++)
          expect(
            deltaE(c[i] as string, c[j] as string),
            `${teams[i]} vs ${teams[j]} on ${background}`,
          ).toBeGreaterThanOrEqual(MIN_DELTA_E);
    },
  );

  test("the Lakers and the Warriors on a dark chart no longer share one gold", async () => {
    await loadLeague("nba");
    const [lal, gs] = teamColorPalette("nba", ["LAL", "GS"], { background: "#181a1b" });
    expect(deltaE(lal as string, gs as string)).toBeGreaterThanOrEqual(MIN_DELTA_E);
  });

  test.each(LEAGUES)("no background (light default), %s: the teams' own colours, unchanged", async (lg) => {
    const teams = await ids(lg);
    const o = { idSystem: "team_id" } as const;
    expect(teamColorPalette(lg, teams, o)).toEqual(teamColorsSync(lg, teams, o));
    expect(teamColorPalette(lg, teams, { ...o, which: "secondary" })).toEqual(
      teamColorsSync(lg, teams, { ...o, which: "secondary" }),
    );
  });
});
