// @vitest-environment jsdom
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { BarChart, BarPlot } from "@mui/x-charts/BarChart";
import { ChartsContainer } from "@mui/x-charts/ChartsContainer";
import { ChartsXAxis } from "@mui/x-charts/ChartsXAxis";
import { ChartsYAxis } from "@mui/x-charts/ChartsYAxis";
import { LineChart } from "@mui/x-charts/LineChart";
import { ScatterChart } from "@mui/x-charts/ScatterChart";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { InputError } from "../src/errors.js";
import { getLeagueSync } from "../src/index-data.js";
import {
  contrast,
  headshotUrl,
  hex6,
  logoUrlSync,
  resetWarnings,
  resolveSync,
  setWarningHandler,
} from "../src/index.js";
import {
  type MuiMarkerProps,
  headshotMarker,
  logoMark,
  logoMarker,
  logoTickLabel,
  teamColorGetter,
  teamColorPalette,
  teamColors,
} from "../src/mui.js";
import { teamColorPalette as rechartsPalette } from "../src/recharts.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE } from "../src/team-palette.js";
import { drawnMarks } from "../src/testing/index.js";
import "./_fixtures.js";

beforeEach(() => resetWarnings()); // warn() dedupes per key per process; every test counts its own
afterEach(cleanup);

/** The warnings `fn` emits. */
function warnings<T>(fn: () => T): { out: T; warned: string[] } {
  const warned: string[] = [];
  setWarningHandler((m) => warned.push(m));
  try {
    return { out: fn(), warned };
  } finally {
    setWarningHandler(null);
  }
}
const ID = (t: string) => resolveSync(t, "nfl") as string;
const URL_OF = (t: string) => logoUrlSync(t, "nfl") as string;
const num = (el: Element, a: string) => Number(el.getAttribute(a));
/** An image's box and centre, in its own frame. */
const box = (img: Element) => {
  const [x, y, w, h] = ["x", "y", "width", "height"].map((a) => num(img, a)) as [
    number,
    number,
    number,
    number,
  ];
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
};
const images = (c: Element) => [...c.querySelectorAll("image[data-sdv-id]")];
/** The (x, y) of every element's `translate(x, y)` (MUI's scatter markers and axis ticks place themselves so). */
const translate = (el: Element | null) => {
  const m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(el?.getAttribute("transform") ?? "");
  return m === null ? undefined : { x: Number(m[1]), y: Number(m[2]) };
};
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
const SIZE = { width: 480, height: 320 } as const;

// 2024 regular season, points for and against: the AFC West and two from the East
const ROWS = [
  { team: "KC", pf: 385, pa: 326 },
  { team: "LAC", pf: 402, pa: 301 },
  { team: "DEN", pf: 425, pa: 311 },
  { team: "LV", pf: 309, pa: 434 },
  { team: "BUF", pf: 525, pa: 368 },
] as const;
const POINTS = ROWS.map((r) => ({ x: r.pf, y: r.pa }));
const scatter = (slots?: object, extra: object = {}): ReactElement => (
  <ScatterChart
    {...SIZE}
    skipAnimation
    xAxis={[{ min: 280, max: 560 }]}
    yAxis={[{ min: 280, max: 460 }]}
    series={[{ id: "afc", data: POINTS, markerSize: 12 }]}
    {...(slots === undefined ? {} : { slots })}
    {...extra}
  />
);

describe("logoMarker: a scatter's marker slot, in a real MUI X Charts 9.15 render", () => {
  test.each([
    ["abbreviations", ROWS.map((r): string | number => r.team)],
    ["numeric ESPN ids", ROWS.map((r): string | number => Number(ID(r.team)))],
  ])("%s: each logo is centred on the point MUI computes, twice markerSize tall", (_, teams) => {
    // MUI's own markers: circles translated to each point's centre, by data index
    const plain = render(scatter()).container;
    const centres = [...plain.querySelectorAll("circle")].map(translate);
    expect(centres).toHaveLength(ROWS.length);
    cleanup();
    const { container } = render(scatter({ marker: logoMarker({ league: "nfl", teams }) }));
    expect(container.querySelectorAll("circle")).toHaveLength(0); // every point is a logo now
    const imgs = images(container);
    expect(imgs).toHaveLength(ROWS.length);
    imgs.forEach((img, i) => {
      const b = box(img);
      const want = centres[i];
      if (want === undefined) throw new Error(`no MUI marker for point ${i}`);
      close(b.cx, want.x);
      close(b.cy, want.y);
      expect(b.h).toBe(24);
      expect(img.getAttribute("href")).toBe(URL_OF(ROWS[i]?.team as string));
      expect(img.getAttribute("data-sdv-id")).toBe(ID(ROWS[i]?.team as string));
      expect(img.getAttribute("aria-label")).toMatch(/ logo$/);
      expect(img.getAttribute("class")).toContain("MuiScatterChart-marker"); // MUI's own class, kept
    });
    // drawnMarks (sdvplot/testing) reads the same marks back: id, the point in px, height in px
    expect(drawnMarks(container).map((m) => [m.id, m.height, m.kind])).toEqual(
      ROWS.map((r) => [ID(r.team), 24, "logo"]),
    );
    expect(drawnMarks(container)[0]?.x).toBe(centres[0]?.x);
  });

  test("a list per series id, and a wordmark", () => {
    const { container } = render(
      <ScatterChart
        {...SIZE}
        skipAnimation
        series={[
          { id: "west", data: POINTS.slice(0, 4), markerSize: 10 },
          { id: "east", data: POINTS.slice(4), markerSize: 10 },
        ]}
        slots={{
          marker: logoMarker({
            league: "nfl",
            markType: "wordmark",
            teams: { west: ["KC", "LAC", "DEN", "LV"], east: ["BUF"] },
          }),
        }}
      />,
    );
    expect(images(container).map((i) => i.getAttribute("data-sdv-id"))).toEqual(
      ["KC", "LAC", "DEN", "LV", "BUF"].map(ID),
    );
    expect(images(container).map((i) => i.getAttribute("data-sdv-kind"))).toEqual(Array(5).fill("wordmark"));
    // a wordmark keeps its aspect: wider than it is tall
    for (const img of images(container)) expect(box(img).w).toBeGreaterThan(box(img).h);
  });

  test("headshotMarker draws ESPN headshots", () => {
    const { container } = render(
      <ScatterChart
        {...SIZE}
        skipAnimation
        series={[{ data: [{ x: 3928, y: 26 }], markerSize: 20 }]}
        slots={{ marker: headshotMarker({ league: "nfl", players: ["3139477"] }) }}
      />,
    );
    const [img] = images(container);
    expect(img?.getAttribute("href")).toBe(headshotUrl("3139477", "nfl"));
    expect(img?.getAttribute("data-sdv-kind")).toBe("headshot");
    expect(box(img as Element).h).toBe(40);
  });

  test("a missing logo, an unknown team or a point with no team: nothing drawn there, one warning each", () => {
    // Delaware women's hockey has colours but no archived logo
    const del = getLeagueSync("ncaa_whockey").teams.find((t) => t.abbr === "DEL");
    if (del === undefined) throw new Error("no Delaware in ncaa_whockey");
    expect(logoUrlSync("DEL", "ncaa_whockey")).toBeUndefined();
    const { warned } = warnings(() =>
      render(
        <ScatterChart
          {...SIZE}
          skipAnimation
          series={[{ id: "s", data: [...POINTS, { x: 300, y: 300 }], markerSize: 8 }]}
          slots={{ marker: logoMarker({ league: "nfl", teams: ["KC", "XXX", "LAC", "XXX", "DEN"] }) }}
        />,
      ),
    );
    expect(images(document.body).map((i) => i.getAttribute("data-sdv-id"))).toEqual(
      ["KC", "LAC", "DEN"].map(ID),
    );
    expect(warned.filter((w) => /XXX/.test(w))).toHaveLength(1);
    expect(warned.filter((w) => /point 5/.test(w))).toHaveLength(1);
    cleanup();
    const missing = warnings(() =>
      render(
        <ScatterChart
          {...SIZE}
          skipAnimation
          series={[{ data: POINTS.slice(0, 2), markerSize: 8 }]}
          slots={{ marker: logoMarker({ league: "ncaa_whockey", teams: ["DEL", "DEL"] }) }}
        />,
      ),
    );
    expect(images(document.body)).toHaveLength(0);
    expect(missing.warned).toHaveLength(1);
  });

  test("MUI's highlight (1.2 times) and fade (0.3), alpha, and the event handlers stay on the image", () => {
    const slot = logoMarker({ league: "nfl", teams: ["KC"], alpha: 0.5 });
    const onClick = () => {};
    const base: MuiMarkerProps = { seriesId: "s", dataIndex: 0, x: 100, y: 50, size: 10 };
    const at = (p: Partial<MuiMarkerProps> & Record<string, unknown>) =>
      (slot({ ...base, ...p } as MuiMarkerProps)?.props ?? {}) as Record<string, unknown>;
    expect(at({}).height).toBe(20);
    expect(at({}).opacity).toBe(0.5);
    expect(at({ isHighlighted: true }).height).toBe(24);
    expect(at({ isFaded: true }).opacity).toBeCloseTo(0.15);
    const kept = at({
      onClick,
      onPointerEnter: onClick,
      "data-highlighted": true,
      isFaded: false,
      color: "#f00",
    });
    expect([kept.onClick, kept.onPointerEnter, kept["data-highlighted"]]).toEqual([onClick, onClick, true]);
    expect(kept).not.toHaveProperty("color"); // MUI's props that are not SVG attributes stay off the image
    expect(kept).not.toHaveProperty("seriesId");
    const { warned, out } = warnings(() => slot({ ...base, size: 0 }));
    expect([out, warned.length]).toEqual([null, 1]);
    expect(() => logoMarker({ league: "nfl", teams: [], alpha: 2 })).toThrow();
  });
});

// The AFC West's running point differential, weeks 1 to 4 of 2024 (KC 3-0... by score margins)
const WEEKS = [1, 2, 3, 4];
const LINES = [
  { id: "KC", data: [7, 8, 11, 16] },
  { id: "LAC", data: [12, 21, 10, 3] },
  { id: "DEN", data: [-7, -16, 7, 18] },
  { id: "LV", data: [-12, 0, -16, -11] },
];
const end = ({ index }: { index: number }) => index === WEEKS.length - 1;

describe("logoMark: a line's mark slot", () => {
  test("only the end of each line, centred where MUI puts its own mark, the series id as the team", () => {
    const line = (slots?: object) => (
      <LineChart
        {...SIZE}
        skipAnimation
        xAxis={[{ data: WEEKS }]}
        series={LINES.map((s) => ({ ...s, showMark: end, shape: "circle" as const }))}
        {...(slots === undefined ? {} : { slots })}
      />
    );
    const plain = render(line()).container;
    const marks = [...plain.querySelectorAll("circle")].map((c) => ({ x: num(c, "cx"), y: num(c, "cy") }));
    expect(marks).toHaveLength(LINES.length); // one mark per line: its last point
    cleanup();
    const { container } = render(line({ mark: logoMark({ league: "nfl", size: 28 }) }));
    const imgs = images(container);
    expect(imgs.map((i) => i.getAttribute("data-sdv-id"))).toEqual(LINES.map((s) => ID(s.id)));
    imgs.forEach((img, i) => {
      close(box(img).cx, marks[i]?.x as number);
      close(box(img).cy, marks[i]?.y as number);
      expect(box(img).h).toBe(28);
    });
  });

  test("teams maps a series id to its team (numeric ids too); an unmapped series draws nothing and warns once", () => {
    const { warned } = warnings(() =>
      render(
        <LineChart
          {...SIZE}
          skipAnimation
          xAxis={[{ data: WEEKS }]}
          series={[
            { id: "a", data: [1, 2, 3, 4], showMark: end },
            { id: "b", data: [4, 3, 2, 1], showMark: end },
          ]}
          slots={{ mark: logoMark({ league: "nfl", teams: { a: Number(ID("KC")) } }) }}
        />,
      ),
    );
    expect(images(document.body).map((i) => i.getAttribute("data-sdv-id"))).toEqual([ID("KC")]);
    expect(warned.filter((w) => /series b/.test(w))).toHaveLength(1);
  });

  test("size is in px: a fraction or nothing throws", () => {
    expect(() => logoMark({ league: "nfl", size: 0.1 })).toThrow(InputError);
    expect(() => logoMark({ league: "nfl", size: 0 })).toThrow(InputError);
    expect(
      logoMark({ league: "nfl" })({ seriesId: "KC", dataIndex: 0, x: 1, y: 2, hidden: true }),
    ).toBeNull();
  });
});

const TEAMS = ["KC", "BUF", "BAL", "HOU"];
const WINS = [15, 13, 12, 10];
/** A bar chart with the team axis given as `band` (x, or y for horizontal bars), its tick labels through `tick`. */
const bars = (axis: "x" | "y", data: readonly unknown[], tick?: object) => {
  const band = { id: "teams", scaleType: "band" as const, data: [...data], height: 44, width: 60 };
  const value = { id: "wins" };
  return (
    <ChartsContainer
      {...SIZE}
      skipAnimation
      xAxis={[axis === "x" ? band : value]}
      yAxis={[axis === "y" ? band : value]}
      series={[
        { type: "bar", data: WINS.slice(0, data.length), layout: axis === "x" ? "vertical" : "horizontal" },
      ]}
    >
      <BarPlot />
      <ChartsXAxis
        axisId={axis === "x" ? "teams" : "wins"}
        {...(axis === "x" && tick ? { slots: tick } : {})}
      />
      <ChartsYAxis
        axisId={axis === "y" ? "teams" : "wins"}
        {...(axis === "y" && tick ? { slots: tick } : {})}
      />
    </ChartsContainer>
  );
};
/** Each tick label's anchor in the chart's frame: its tick container's translate plus its own x, y. */
const anchors = (c: Element, sel: string) =>
  [...c.querySelectorAll(`[data-axis-id="teams"] ${sel}`)].map((el) => {
    const t = translate(el.closest(".MuiChartsAxis-tickContainer")) ?? { x: 0, y: 0 };
    const axis = translate(el.closest("[data-axis-id]")) ?? { x: 0, y: 0 };
    // a label's own anchor: a text's x, y; an sdvplot image's stamped data-sdv-x, -y
    const own = (a: string) => (el.tagName === "image" ? num(el, `data-sdv-${a}`) : num(el, a));
    return { x: axis.x + t.x + own("x"), y: axis.y + t.y + own("y") };
  });

describe("logoTickLabel: an axis' tick label slot (the composition API)", () => {
  test.each([
    ["abbreviations", TEAMS as (string | number)[]],
    ["numeric ESPN ids", TEAMS.map((t): string | number => Number(ID(t)))],
  ])("%s on a bottom band axis: each logo hangs centred under its label's anchor", (_, data) => {
    const text = anchors(render(bars("x", data)).container, "text");
    expect(text).toHaveLength(TEAMS.length);
    cleanup();
    const { container } = render(
      bars("x", data, { axisTickLabel: logoTickLabel({ league: "nfl", size: 30 }) }),
    );
    const imgs = images(container);
    expect(imgs.map((i) => i.getAttribute("data-sdv-id"))).toEqual(TEAMS.map(ID));
    const at = anchors(container, "image");
    imgs.forEach((img, i) => {
      const b = box(img);
      // anchor = the label's (x, y) in its tick's frame: the logo's top-centre sits there (text-anchor middle, hanging)
      close(at[i]?.x as number, text[i]?.x as number);
      close(at[i]?.y as number, text[i]?.y as number);
      close(b.x + b.w / 2 - Number(img.getAttribute("data-sdv-x")), 0);
      close(b.y, Number(img.getAttribute("data-sdv-y")));
      expect(b.h).toBe(30);
    });
    // and the label's anchor is the band's centre: half a band past the tick that starts it
    const ticks = [...container.querySelectorAll('[data-axis-id="teams"] .MuiChartsAxis-tickContainer')];
    const band = (translate(ticks[1] ?? null)?.x ?? 0) - (translate(ticks[0] ?? null)?.x ?? 0);
    close(Number(imgs[0]?.getAttribute("data-sdv-x")), band / 2);
  });

  test("on a left band axis (horizontal bars) each logo ends at its label's anchor, centred on it", () => {
    const { container } = render(bars("y", TEAMS, { axisTickLabel: logoTickLabel({ league: "nfl" }) }));
    for (const img of images(container)) {
      const b = box(img);
      close(b.x + b.w, Number(img.getAttribute("data-sdv-x"))); // text-anchor end
      close(b.cy, Number(img.getAttribute("data-sdv-y"))); // dominant-baseline central
    }
    expect(images(container)).toHaveLength(TEAMS.length);
  });

  test("a label with no logo keeps its text, where and as MUI writes it, and warns once", () => {
    const { warned } = warnings(() =>
      render(bars("x", ["KC", "XXX"], { axisTickLabel: logoTickLabel({ league: "nfl" }) })),
    );
    const text = document.querySelector('[data-axis-id="teams"] text');
    expect(text?.textContent).toBe("XXX");
    expect(text?.getAttribute("text-anchor")).toBe("middle");
    expect(text?.getAttribute("dominant-baseline")).toBe("hanging");
    expect(text?.getAttribute("class")).toContain("MuiChartsAxis-tickLabel");
    expect(images(document.body)).toHaveLength(1);
    expect(warned.filter((w) => /XXX/.test(w))).toHaveLength(1);
    expect(() => logoTickLabel({ league: "nfl", size: 0.5 })).toThrow(InputError);
  });

  test("on a BarChart in 9.15 an axis' own `slots` are dropped, which is why the guide uses the composition API", () => {
    // pinned so a fixed MUI shows up here: the guide can then offer the one-component chart too
    const { container } = render(
      <BarChart
        {...SIZE}
        skipAnimation
        xAxis={[
          { scaleType: "band", data: TEAMS, slots: { axisTickLabel: logoTickLabel({ league: "nfl" }) } },
        ]}
        series={[{ data: WINS }]}
      />,
    );
    expect(images(container)).toHaveLength(0);
  });
});

describe("team colours", () => {
  const strokes = (c: Element) =>
    [...c.querySelectorAll("path.MuiLineChart-line")].map((p) => p.getAttribute("stroke"));
  test.each(["light", "dark"] as const)(
    "teamColors follows the ThemeProvider's %s mode: each line strokes its team's colour for that background",
    (mode) => {
      const colors = teamColors(
        "nfl",
        LINES.map((s) => s.id),
      );
      const { container } = render(
        <ThemeProvider theme={createTheme({ palette: { mode } })}>
          <LineChart {...SIZE} skipAnimation colors={colors} xAxis={[{ data: WEEKS }]} series={LINES} />
        </ThemeProvider>,
      );
      const bg = mode === "dark" ? "#121212" : "#ffffff";
      const want = teamColorPalette(
        "nfl",
        LINES.map((s) => s.id),
        { background: bg },
      );
      expect(strokes(container).map((s) => hex6(s ?? ""))).toEqual(want);
      if (mode === "dark") {
        // Denver's navy and the Raiders' black are unreadable on #121212: they changed
        expect(want).not.toEqual(
          teamColorPalette(
            "nfl",
            LINES.map((s) => s.id),
          ),
        );
      }
    },
  );

  test("every NFL and NBA team keeps 3:1 contrast and stays ΔE 20 apart in both modes, without a warning", () => {
    for (const league of ["nfl", "nba"] as const) {
      const teams = getLeagueSync(league).teams.map((t) => t.abbr);
      const palette = teamColors(league, teams);
      for (const [mode, bg] of [
        ["light", "#ffffff"],
        ["dark", "#121212"],
      ] as const) {
        const { out, warned } = warnings(() => palette(mode));
        expect(warned).toEqual([]);
        expect(out).toHaveLength(teams.length);
        for (const c of out) expect(contrast(c, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
        for (let i = 0; i < out.length; i++)
          for (let j = i + 1; j < out.length; j++)
            expect(deltaE(out[i] as string, out[j] as string)).toBeGreaterThanOrEqual(MIN_DELTA_E);
        expect(out).toEqual(rechartsPalette(league, teams, { background: bg })); // the shared palette, no copy
      }
    }
  });

  test("custom backgrounds; each call returns a fresh array MUI may keep", () => {
    const p = teamColors("nfl", ["DEN", "LV"], { background: { dark: "#1e2229" } });
    expect(p("dark")).toEqual(teamColorPalette("nfl", ["DEN", "LV"], { background: "#1e2229" }));
    expect(p("dark")).not.toBe(p("dark"));
    expect(p("light")).toEqual(teamColorPalette("nfl", ["DEN", "LV"], { background: "#ffffff" }));
  });

  test("teamColorGetter colours each bar by its own team in a real BarChart; a repeated team keeps one colour", () => {
    const teams = ["KC", "BUF", "KC", "DEN"];
    const getter = teamColorGetter("nfl", teams, { background: "#ffffff" });
    const { container } = render(
      <BarChart
        {...SIZE}
        skipAnimation
        xAxis={[{ scaleType: "band", data: ["w1", "w2", "w3", "w4"] }]}
        series={[{ data: [3, 4, 5, 6], colorGetter: getter }]}
      />,
    );
    const fills = [...container.querySelectorAll("rect.MuiBarChart-element")].map((r) =>
      hex6(r.getAttribute("fill") ?? ""),
    );
    const want = teamColorPalette("nfl", teams, { background: "#ffffff" });
    expect(fills).toEqual(want);
    expect(fills[0]).toBe(fills[2]);
    expect(getter({ dataIndex: 9 })).toBe("#808080"); // past the end of teams: the fallback
  });
});
