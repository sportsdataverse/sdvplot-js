// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { contrast } from "../src/contrast.js";
import { InputError } from "../src/errors.js";
import { getLeagueSync } from "../src/index-data.js";
import {
  logoUrlSync,
  placeSync,
  resetWarnings,
  resolveSync,
  setWarningHandler,
  teamColorsSync,
} from "../src/index.js";
import {
  type LwcSeriesPrimitive,
  TRADINGVIEW_NOTICE,
  attributionNotice,
  drawnMarks,
  logoMarkers,
  teamSeriesOptions,
  withAttribution,
} from "../src/lightweight-charts.js";
import { MIN_CONTRAST, MIN_DELTA_E, deltaE } from "../src/team-palette.js";
import "./_fixtures.js";
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

// fancy-canvas watches the device pixel ratio through matchMedia; jsdom has none.
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
}));
const { createChart, LineSeries } = await import("lightweight-charts");

beforeAll(() => {
  mockCanvas();
  vi.stubGlobal("Image", FakeImage);
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  resetWarnings();
  FakeImage.made = [];
});

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
/** Lightweight Charts paints on the next animation frame. */
const frame = () => new Promise((r) => setTimeout(r, 60));
const landAll = async (): Promise<void> => {
  for (const i of FakeImage.made) if (!i.complete) i.land();
  await frame();
};
function warnings(f: () => void): string[] {
  const out: string[] = [];
  setWarningHandler((m) => out.push(m));
  try {
    f();
  } finally {
    setWarningHandler(null);
  }
  return out;
}
const aspectOf = (team: string): number => placeSync([0], [0], [team], { league: "nfl" })[0]?.aspect ?? 1;

/** Super Bowl LIX's first minutes, from SUPER_BOWL_LIX_WP (examples' ESPN fixture): seconds played, PHI win prob. */
const WP = [
  { time: 0, value: 0.5809 },
  { time: 41, value: 0.5989 },
  { time: 82, value: 0.5909 },
  { time: 123, value: 0.5615 },
  { time: 154, value: 0.5482 },
];
// two points on the line (a logo off the pane is not drawn, so these sit inside the series price range)
const ENDS = [
  { t: 154, wp: 0.5482, team: "PHI" },
  { t: 41, wp: 0.5989, team: "KC" },
];

function chart(
  primitive?: LwcSeriesPrimitive,
  chartOptions: Parameters<typeof createChart>[1] = withAttribution({ width: 600, height: 400 }),
) {
  const el = document.body.appendChild(document.createElement("div"));
  const c = createChart(el, chartOptions);
  const s = c.addSeries(LineSeries, { color: "#333333" });
  s.setData(WP.map((p) => ({ time: p.time as never, value: p.value })));
  if (primitive !== undefined) s.attachPrimitive(primitive);
  return { el, c, s };
}
const draws = (el: HTMLElement): Call[] =>
  [...el.querySelectorAll("canvas")].flatMap((cv) =>
    (calls.get(cv) ?? []).filter(([n]) => n === "drawImage"),
  );
const tvLink = (el: HTMLElement) => el.querySelector('a[href^="https://www.tradingview.com"]');

describe("withAttribution: the TradingView notice is on by default", () => {
  test("turns layout.attributionLogo on; copies, never mutates, and keeps the rest of the options", () => {
    const opts = { width: 600, layout: { textColor: "#222222" } };
    const got = withAttribution(opts);
    expect(got).toEqual({ width: 600, layout: { textColor: "#222222", attributionLogo: true } });
    expect(opts).toEqual({ width: 600, layout: { textColor: "#222222" } });
    expect(withAttribution()).toEqual({ layout: { attributionLogo: true } });
  });

  test("a real chart built from withAttribution shows TradingView's link; one with the logo off has none", async () => {
    const on = chart();
    await frame();
    expect(tvLink(on.el)).not.toBeNull();
    const off = chart(undefined, { width: 600, height: 400, layout: { attributionLogo: false } });
    await frame();
    expect(tvLink(off.el)).toBeNull(); // the control: the selector does find the absence
  });

  test("a caller's attributionLogo: false is turned back on, with one warning naming the opt-out", () => {
    const w = warnings(() => {
      expect(withAttribution({ layout: { attributionLogo: false } }).layout.attributionLogo).toBe(true);
      withAttribution({ layout: { attributionLogo: false } });
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/attributedElsewhere/);
  });

  test("only the explicit attributedElsewhere: true removes it, and a real chart then has no link", async () => {
    const got = withAttribution({ width: 600, height: 400 }, { attributedElsewhere: true });
    expect(got.layout.attributionLogo).toBe(false);
    expect(withAttribution({}, { attributedElsewhere: false }).layout.attributionLogo).toBe(true);
    for (const bad of ["yes", 1, null])
      expect(() => withAttribution({}, { attributedElsewhere: bad as never })).toThrow(InputError);
    const { el } = chart(undefined, got);
    await frame();
    expect(tvLink(el)).toBeNull();
  });

  test("attributionNotice puts the notice on the page once: its text is TRADINGVIEW_NOTICE exactly, the URL a link", () => {
    const host = document.body.appendChild(document.createElement("div"));
    const p = attributionNotice(host);
    expect(p.tagName).toBe("P");
    expect(p.parentElement).toBe(host);
    expect(p.textContent).toBe(TRADINGVIEW_NOTICE);
    expect(p.textContent).toContain("Copyright (с) 2025"); // the Cyrillic letter survives
    const a = p.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://www.tradingview.com/");
    expect(a?.textContent).toBe("https://www.tradingview.com/");
    expect(attributionNotice(host)).toBe(p); // idempotent: the same notice, not a second one
    expect(host.querySelectorAll("p")).toHaveLength(1);
    // a notice deeper inside (another chart's figure) does not stand in for this container's own
    const outer = document.body.appendChild(document.createElement("div"));
    attributionNotice(outer.appendChild(document.createElement("div")));
    expect(attributionNotice(outer).parentElement).toBe(outer);
  });

  test("TRADINGVIEW_NOTICE is the NOTICE file's text at 5.2.1, verbatim in both NOTICE.md files", () => {
    // the NOTICE of tradingview/lightweight-charts at tag v5.2.1; its "с" is Cyrillic U+0441, as upstream writes it
    expect(TRADINGVIEW_NOTICE).toBe(
      "TradingView Lightweight Charts™\nCopyright (с) 2025 TradingView, Inc. https://www.tradingview.com/",
    );
    for (const f of ["NOTICE.md", "packages/sdvplot/NOTICE.md"])
      expect(readFileSync(resolve(ROOT, f), "utf8").replace(/\r\n/g, "\n")).toContain(TRADINGVIEW_NOTICE);
  });
});

describe("teamSeriesOptions", () => {
  test("the team's colour; probability prices read as percentages, American odds with their sign", () => {
    const [phi] = teamColorsSync("nfl", ["PHI"]) as [string];
    const p = teamSeriesOptions("PHI", { league: "nfl", units: "probability" });
    expect(p.color).toBe(phi);
    expect(p.priceFormat?.type).toBe("custom");
    const fp = p.priceFormat?.formatter as (v: number) => string;
    expect([0, 0.5846, 0.5, 1].map(fp)).toEqual(["0%", "58.5%", "50%", "100%"]);
    expect(p.priceFormat?.minMove).toBe(0.001);
    const a = teamSeriesOptions("KC", { league: "nfl", units: "american" });
    const fa = a.priceFormat?.formatter as (v: number) => string;
    expect([150, -120, 100, -100].map(fa)).toEqual(["+150", "-120", "+100", "-100"]);
    // rounded symmetrically (half away from zero), and never a signed zero
    expect([150.5, -150.5, 0.4, -0.4, 0, -0].map(fa)).toEqual(["+151", "-151", "0", "0", "0", "0"]);
    expect(a.priceFormat?.minMove).toBe(1);
    expect(teamSeriesOptions("KC", { league: "nfl" })).toEqual({ color: teamColorsSync("nfl", ["KC"])[0] });
    expect(() => teamSeriesOptions("KC", { league: "nfl", units: "percent" as never })).toThrow(InputError);
  });

  test("a real Lightweight Charts series takes the options: its colour, and its price formatter reads percent", () => {
    const { c } = chart();
    const s = c.addSeries(LineSeries, teamSeriesOptions("PHI", { league: "nfl", units: "probability" }));
    expect(s.options().color).toBe(teamColorsSync("nfl", ["PHI"])[0]);
    expect(s.priceFormatter().format(0.5846)).toBe("58.5%");
  });

  test("an unresolved team takes the fallback, warns, and stays out of the palette", () => {
    const w = warnings(() => expect(teamSeriesOptions("XXX", { league: "nfl" }).color).toBe("#808080"));
    expect(w.join()).toMatch(/XXX/);
    // the fallback is Kansas City's own red: in the palette it would push KC ΔE 20 away from its colour
    const [kc] = teamColorsSync("nfl", ["KC"]) as [string];
    const o = { league: "nfl", background: "#ffffff", fallback: kc, teams: ["XXX", "KC"] } as const;
    warnings(() => {
      expect(teamSeriesOptions("KC", o).color).toBe(kc);
      expect(teamSeriesOptions("XXX", o).color).toBe(kc);
    });
  });

  test("team must be one of teams", () => {
    expect(() => teamSeriesOptions("KC", { league: "nfl", teams: ["PHI", "BUF"] })).toThrow(InputError);
  });

  const LEAGUES = ["nba", "nfl", "mlb", "nhl"] as const;
  test.each(LEAGUES.flatMap((lg) => ["#181a1b", "#000000", "#ffffff"].map((bg) => [lg, bg] as const)))(
    "dark mode (Review Focus 4): %s in league order on %s, every colour reads (3:1), every pair MIN_DELTA_E apart, no warning",
    (lg, background) => {
      const teams = getLeagueSync(lg).teams.map((t) => t.team_id);
      let c: string[] = [];
      const w = warnings(() => {
        c = teams.map(
          (t) => teamSeriesOptions(t, { league: lg, background, teams, idSystem: "team_id" }).color,
        );
      });
      expect(w).toEqual([]);
      for (const x of c) expect(contrast(x, background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      const close = c.flatMap((x, i) =>
        c.slice(0, i).flatMap((p, j) => (deltaE(x, p) < MIN_DELTA_E ? [`${teams[j]}/${teams[i]}`] : [])),
      );
      expect(close).toEqual([]);
      // a colour that already reads and is distinct is the team's own (the test is not vacuous: some are kept)
      const own = teamColorsSync(lg, teams, { idSystem: "team_id" });
      expect(c.filter((x, i) => x === own[i]).length).toBeGreaterThan(0);
    },
  );

  test("without a background the colours are the teams' own (the light default)", () => {
    const teams = ["PHI", "KC"];
    expect(teams.map((t) => teamSeriesOptions(t, { league: "nfl", teams }).color)).toEqual(
      teamColorsSync("nfl", teams),
    );
  });
});

describe("logoMarkers: a series primitive painting team logos", () => {
  test("draws each row's logo centred on the chart's own time and price coordinates, height of the pane tall", async () => {
    const prim = logoMarkers(ENDS, { x: "t", y: "wp", team: "team", league: "nfl", height: 0.1 });
    expect(FakeImage.made).toEqual([]); // building it fetches nothing
    const { el, c, s } = chart(prim);
    expect(FakeImage.made.map((i) => i.src)).toEqual([logoUrlSync("PHI", "nfl"), logoUrlSync("KC", "nfl")]);
    expect(FakeImage.made.every((i) => i.crossOrigin === "anonymous")).toBe(true);
    await frame();
    expect(draws(el)).toEqual([]); // nothing until the images load
    await landAll(); // each load asks the chart for a redraw
    const got = draws(el);
    expect(got).toHaveLength(2);
    const ph = 0.1 * c.paneSize().height;
    ENDS.forEach((r, i) => {
      const [img, x, y, w, h, alpha] = got[i]?.[1] as [FakeImage, number, number, number, number, number];
      expect(img.src).toBe(logoUrlSync(r.team, "nfl"));
      expect(h).toBeCloseTo(ph);
      expect(w).toBeCloseTo(ph * aspectOf(r.team));
      expect(x + w / 2).toBeCloseTo(c.timeScale().timeToCoordinate(r.t as never) as number);
      expect(y + h / 2).toBeCloseTo(s.priceToCoordinate(r.wp) as number);
      expect(alpha).toBe(1);
    });
    const ids = ENDS.map((r) => resolveSync(r.team, "nfl"));
    expect(drawnMarks(prim)).toEqual(
      ENDS.map((r, i) => [ids[i], r.t, r.wp, 0.1, logoUrlSync(r.team, "nfl")]),
    );
  });

  test("alpha is applied", async () => {
    const { el } = chart(logoMarkers(ENDS, { x: "t", y: "wp", team: "team", league: "nfl", alpha: 0.5 }));
    await landAll();
    expect(draws(el).map(([, a]) => a[5])).toEqual([0.5, 0.5]);
  });

  test("a team with no logo draws nothing and warns once (no broken image)", async () => {
    const rows = [
      { t: 154, wp: 0.5482, team: "XXX" },
      { t: 41, wp: 0.5989, team: "KC" },
    ];
    let prim: LwcSeriesPrimitive | undefined;
    const w = warnings(() => {
      prim = logoMarkers(rows, { x: "t", y: "wp", team: "team", league: "nfl" });
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/XXX/);
    const { el } = chart(prim);
    await landAll();
    expect(draws(el)).toHaveLength(1);
    expect(drawnMarks(prim as LwcSeriesPrimitive).map((m) => m[4])).toEqual([logoUrlSync("KC", "nfl")]);
  });

  test("an image that fails to load is never drawn and warns once", async () => {
    const out: string[] = [];
    setWarningHandler((m) => out.push(m));
    try {
      const { el } = chart(logoMarkers(ENDS, { x: "t", y: "wp", team: "team", league: "nfl" }));
      FakeImage.made[0]?.fail();
      FakeImage.made[0]?.fail();
      await landAll();
      expect(draws(el)).toHaveLength(1);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatch(/could not load/);
    } finally {
      setWarningHandler(null);
    }
  });

  test("a row at a time the chart has no point for, or off the price scale, is not drawn", async () => {
    const rows = [
      { t: 9999, wp: 0.5, team: "PHI" }, // no such time on the series
      { t: 154, wp: 50, team: "KC" }, // far above the pane
      { t: 41, wp: 0.59, team: "BUF" },
    ];
    const prim = logoMarkers(rows, { x: "t", y: "wp", team: "team", league: "nfl" });
    const { el } = chart(prim);
    await landAll();
    expect(draws(el)).toHaveLength(1);
    expect(drawnMarks(prim).map((m) => m[1])).toEqual([41]);
  });

  test("detached: forgets the chart and draws nothing more", async () => {
    const prim = logoMarkers(ENDS, { x: "t", y: "wp", team: "team", league: "nfl" });
    const { el, s } = chart(prim);
    s.detachPrimitive(prim);
    await landAll();
    expect(draws(el)).toEqual([]);
  });

  test("attached again: draws its loaded logos at once, loading nothing new", async () => {
    const prim = logoMarkers(ENDS, { x: "t", y: "wp", team: "team", league: "nfl" });
    const { s } = chart(prim);
    await landAll();
    expect(drawnMarks(prim)).toHaveLength(2);
    s.detachPrimitive(prim);
    expect(drawnMarks(prim)).toEqual([]); // detached, it is on no chart
    await frame();
    s.attachPrimitive(prim);
    await frame();
    expect(drawnMarks(prim)).toHaveLength(2);
    expect(FakeImage.made).toHaveLength(2);
  });

  test("units: height is a fraction of the pane, not px; a probability is a fraction, American odds are |v| >= 100", () => {
    const o = { x: "t", y: "wp", team: "team", league: "nfl" } as const;
    for (const height of [24, 1.5, 0, Number.NaN])
      expect(() => logoMarkers(ENDS, { ...o, height })).toThrow(InputError);
    expect(() => logoMarkers(ENDS, { ...o, height: 1 })).not.toThrow();
    expect(() => logoMarkers(ENDS, { ...o, alpha: 2 })).toThrow(InputError);
    expect(() => logoMarkers([{ t: 1, wp: 58.46, team: "PHI" }], { ...o, units: "probability" })).toThrow(
      /fraction in \[0, 1\].*percent/,
    );
    expect(() => logoMarkers(ENDS, { ...o, units: "probability" })).not.toThrow();
    expect(() => logoMarkers([{ t: 1, wp: 1.91, team: "PHI" }], { ...o, units: "american" })).toThrow(
      /American odds.*decimal/,
    );
    expect(() => logoMarkers([{ t: 1, wp: -110, team: "PHI" }], { ...o, units: "american" })).not.toThrow();
    expect(() => logoMarkers(ENDS, { ...o, units: "percent" as never })).toThrow(InputError);
    expect(() => logoMarkers(ENDS, { ...o, team: "club" })).toThrow(/team column/);
  });

  test("palette vs drawn: the drawn marks' team ids colour exactly as the rows' team names do", async () => {
    const rows = [
      { t: 41, wp: 0.59, team: "Eagles" },
      { t: 82, wp: 0.56, team: "KC" },
      { t: 123, wp: 0.55, team: "Buffalo Bills" },
    ];
    const prim = logoMarkers(rows, { x: "t", y: "wp", team: "team", league: "nfl" });
    chart(prim);
    await landAll();
    const ids = drawnMarks(prim).map((m) => m[0]);
    expect(ids).toHaveLength(3);
    for (const background of [undefined, "#181a1b"]) {
      const bg = background === undefined ? {} : { background };
      const byName = rows.map((r) =>
        teamSeriesOptions(r.team, { league: "nfl", teams: rows.map((x) => x.team), ...bg }),
      );
      const byId = ids.map((id) =>
        teamSeriesOptions(id, { league: "nfl", teams: ids, idSystem: "team_id", ...bg }),
      );
      expect(byId.map((x) => x.color)).toEqual(byName.map((x) => x.color));
      expect(new Set(byId.map((x) => x.color)).size).toBe(3);
    }
  });
});
