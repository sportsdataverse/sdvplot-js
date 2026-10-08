// @vitest-environment jsdom
// Phase 11 (J39, J40): the image marks compute only src / size / skip-and-warn; every other Plot option passes through.
import * as Plot from "@observablehq/plot";
import { beforeAll, beforeEach, expect, test } from "vitest";
import TDS from "../../../../fixtures/examples/espn_nfl_summary_401671889_offense_tds.json" with {
  type: "json",
};
import { STANDINGS, type Standing } from "../../../sdvtables/test/fixtures/standings.js";
import { InputError, loadLeague, resetWarnings, setWarningHandler } from "../../src/index.js";
import { headshots, logos } from "../../src/plot/index.js";
import { drawnMarks } from "../../src/testing/index.js";
import { centreOf, pointAt, stubBBox, teamEpa2024, tipText } from "./_pointer.js";

const TEAMS = teamEpa2024();
const warnings: string[] = [];
beforeAll(async () => {
  stubBBox();
  await loadLeague("nfl");
});
beforeEach(() => {
  resetWarnings();
  warnings.length = 0;
  setWarningHandler((m) => warnings.push(m));
});
const box = (img: Element) => ({
  w: Number(img.getAttribute("width")),
  h: Number(img.getAttribute("height")),
});

test("dodgeY beeswarm: 32 real teams by net EPA/play, every logo drawn, centres at least 2r apart, never clipped", () => {
  expect(TEAMS).toHaveLength(32);
  const frame = 240 - 20 - 30;
  const height = 0.12;
  const r = (height * frame) / 2; // half the drawn height: neighbours just touch
  const svg = Plot.plot({
    height: 240,
    width: 760,
    marginTop: 20,
    marginBottom: 30,
    marks: [logos(TEAMS, Plot.dodgeY({ league: "nfl", team: "team", x: "net", r, height, padding: 1 }))],
  });
  const imgs = Array.from(svg.querySelectorAll("image"));
  expect(imgs).toHaveLength(32);
  expect(imgs.every((i) => i.getAttribute("clip-path") === null)).toBe(true); // dodge's r is not Plot.image's r
  expect(imgs.every((i) => Math.abs(box(i).h - height * frame) < 1e-9)).toBe(true);
  const c = imgs.map(centreOf);
  let min = Number.POSITIVE_INFINITY;
  for (let a = 0; a < c.length; a++)
    for (let b = a + 1; b < c.length; b++) {
      const [ax, ay] = c[a] as [number, number];
      const [bx, by] = c[b] as [number, number];
      min = Math.min(min, Math.hypot(ax - bx, ay - by));
    }
  expect(min).toBeGreaterThanOrEqual(2 * r - 1e-6); // measured 23.80 px vs 22.80
  const kc = drawnMarks(svg).find((m) => m.id === "12");
  expect(kc?.x).toBeCloseTo(TEAMS.find((t) => t.team === "KC")?.net ?? Number.NaN, 12); // x keeps its data value
  expect(kc?.y).toBeNull(); // dodge's y is screen space: no data value to report
  expect(svg.outerHTML).not.toMatch(/NaN/);
});

test("dodge's two-argument form and dodgeX also wrap the mark", () => {
  const a = Plot.plot({
    marks: [
      logos(TEAMS, Plot.dodgeY({ anchor: "middle", r: 14 }, { league: "nfl", team: "team", x: "net" })),
    ],
  });
  const b = Plot.plot({
    height: 600,
    marks: [logos(TEAMS, Plot.dodgeX({ league: "nfl", team: "team", y: "net", r: 14 }))],
  });
  expect(a.querySelectorAll("image")).toHaveLength(32);
  expect(b.querySelectorAll("image")).toHaveLength(32);
  // the dodge ran: without it every logo sits on the frame middle, one position on the dodged axis
  const spread = (svg: Element, k: 0 | 1): number =>
    new Set(Array.from(svg.querySelectorAll("image"), (i) => centreOf(i)[k].toFixed(3))).size;
  expect(spread(a, 1)).toBeGreaterThan(1);
  expect(spread(b, 0)).toBeGreaterThan(1);
});

test("tip: hovering KC's logo shows its team and both positions; figure.value is KC's row", () => {
  const svg = Plot.plot({
    width: 640,
    height: 400,
    marks: [logos(STANDINGS, { league: "nfl", x: "wins", y: "pf", team: "team", tip: true })],
  });
  const [x, y] = centreOf(svg.querySelector('image[data-sdv-id="12"]') as Element);
  pointAt(svg, x, y);
  expect(tipText(svg)).toMatch(/team\s*KC/);
  expect(tipText(svg)).toMatch(/wins\s*15/);
  expect(tipText(svg)).toMatch(/pf\s*385/);
  expect((svg as unknown as { value: Standing }).value.team).toBe("KC");
});

test("mark-level fx: one facet per division, height a fraction of the FACET frame", () => {
  const svg = Plot.plot({
    height: 300,
    marginTop: 30,
    marginBottom: 30,
    marks: [
      logos(STANDINGS, { league: "nfl", x: "wins", y: "pf", team: "team", fx: "division", height: 0.2 }),
    ],
  });
  expect(
    Array.from(svg.querySelectorAll("[aria-label='fx-axis tick label'] text"), (t) => t.textContent),
  ).toEqual(["East", "West"]);
  const dm = drawnMarks(svg);
  expect(dm).toHaveLength(8);
  expect(dm.every((d) => Math.abs(d.height - 0.2) < 1e-9)).toBe(true);
});

test("filter, sort, href, target, dx, className and clip pass through", () => {
  const svg = Plot.plot({
    x: { domain: [0, 17] },
    marks: [
      logos(STANDINGS, {
        league: "nfl",
        x: "wins",
        y: "pf",
        team: "team",
        filter: (d: Standing) => d.wins >= 10,
        sort: { channel: "x" },
        href: (d: Standing) => `https://www.espn.com/nfl/team/_/name/${d.team.toLowerCase()}`,
        target: "_blank",
        dx: 4,
        className: "afc-logos",
        clip: "frame",
      }),
    ],
  });
  expect(drawnMarks(svg).map((m) => m.x)).toEqual([10, 11, 13, 15]);
  expect(svg.querySelectorAll("a[href^='https://www.espn.com'] > image")).toHaveLength(4);
  expect(svg.querySelector("g.afc-logos")).not.toBeNull();
  expect(svg.outerHTML).toMatch(/clip-path="url\(#plot-clip-\d+\)"/);
});

test("Plot.pointer composes OUTSIDE sdvplot's sizing: only the pointed logo is drawn, at full size", () => {
  const svg = Plot.plot({
    width: 640,
    height: 400,
    marks: [
      logos(STANDINGS, { league: "nfl", x: "wins", y: "pf", team: "team", alpha: 0.25 }),
      logos(STANDINGS, Plot.pointer({ league: "nfl", x: "wins", y: "pf", team: "team", height: 0.2 })),
    ],
  });
  const top = () => svg.querySelectorAll("g[aria-label=image]")[1]?.querySelectorAll("image") ?? [];
  expect(top()).toHaveLength(0);
  const [x, y] = centreOf(svg.querySelector('image[data-sdv-id="12"]') as Element);
  pointAt(svg, x, y);
  expect(top()).toHaveLength(1);
  expect(top()[0]?.getAttribute("data-sdv-id")).toBe("12");
  expect(Number(top()[0]?.getAttribute("height"))).toBeCloseTo(0.2 * (400 - 20 - 30), 6);
});

test("an aggregating transform (group, bin, hexbin) throws InputError: one image per input row", () => {
  expect(() =>
    Plot.plot({
      marks: [logos(STANDINGS, Plot.groupX({ y: "count" }, { league: "nfl", x: "division", team: "team" }))],
    }),
  ).toThrow(InputError);
});

test("Plot.hexbin keeps the data but bins the channels: 8 rows in 3 bins throw InputError and draw nothing", () => {
  // measured: binWidth 640 bins the 8 rows as {KC, LAC, DEN, BUF}, {LV, MIA, NE}, {NYJ}; unguarded it drew 3 images
  // named "KC logo | LAC logo | DEN logo", rows 0..2 rather than the bins' members
  let svg: Element | undefined;
  expect(() => {
    svg = Plot.plot({
      marks: [
        logos(STANDINGS, Plot.hexbin({}, { league: "nfl", x: "wins", y: "pf", team: "team", binWidth: 640 })),
      ],
    });
  }).toThrow(InputError);
  expect(svg).toBeUndefined();
});

test("dodgeY without r runs as the mark (Plot's dodge reads this.r): Plot's default 3 px radius, every logo drawn", () => {
  const svg = Plot.plot({ marks: [logos(TEAMS, Plot.dodgeY({ league: "nfl", team: "team", x: "net" }))] });
  expect(svg.querySelectorAll("image")).toHaveLength(32);
});

test("a 1:1 hexbin across facets (one bin per row, renumbered per facet) throws InputError", () => {
  // every row its own bin, so each channel still has 8 values; but East's bins are 0..3, which are West's rows
  expect(() =>
    Plot.plot({
      marks: [
        logos(
          STANDINGS,
          Plot.hexbin({}, { league: "nfl", x: "wins", y: "pf", team: "team", fx: "division", binWidth: 1 }),
        ),
      ],
    }),
  ).toThrow(InputError);
});

test("accessibility: each image is named by its team (the Vega adapter's rule, PR #28); ariaDescription passes through", () => {
  const svg = Plot.plot({
    marks: [
      logos(STANDINGS, { league: "nfl", x: "wins", y: "pf", team: "team", ariaDescription: "2024 AFC" }),
    ],
  });
  const labels = Array.from(svg.querySelectorAll("image")).map((i) => i.getAttribute("aria-label"));
  expect(labels.slice(0, 3)).toEqual(["KC logo", "LAC logo", "DEN logo"]);
  expect(svg.querySelector("g[aria-label=image]")?.getAttribute("aria-description")).toBe("2024 AFC");
});

test("skip-and-warn once per reason holds; a skipped row draws no empty <image>", () => {
  const [kc, lac] = STANDINGS as [Standing, Standing];
  const rows = [kc, lac, { ...kc, team: "XXX" }, { ...lac, pf: null as unknown as number }];
  const svg = Plot.plot({ marks: [logos(rows, { league: "nfl", x: "wins", y: "pf", team: "team" })] });
  expect(svg.querySelectorAll("image")).toHaveLength(2);
  expect(warnings.some((w) => /did not resolve.*XXX/.test(w))).toBe(true);
  expect(warnings.some((w) => /skipped 1 point\(s\) with a missing x or y: LAC/.test(w))).toBe(true);
});

test("alpha (a constant) and opacity (Plot's channel) are exclusive; opacity alone is a channel", () => {
  expect(() =>
    logos(STANDINGS, { league: "nfl", x: "wins", y: "pf", team: "team", alpha: 0.5, opacity: 0.5 }),
  ).toThrow(InputError);
  const svg = Plot.plot({
    marks: [
      logos(STANDINGS, {
        league: "nfl",
        x: "wins",
        y: "pf",
        team: "team",
        opacity: (d: Standing) => d.wins / 17,
      }),
    ],
  });
  expect(svg.querySelector('image[data-sdv-id="12"]')?.getAttribute("opacity")).toBe(String(15 / 17));
});

test("headshots open too: tip with a title names the quarterback", () => {
  const svg = Plot.plot({
    width: 640,
    height: 400,
    marks: [
      headshots(STANDINGS, {
        league: "nfl",
        x: "wins",
        y: "pf",
        player: "qb_espn_id",
        tip: true,
        title: "qb",
      }),
    ],
  });
  const [x, y] = centreOf(svg.querySelector("image") as Element);
  pointAt(svg, x, y);
  expect(tipText(svg)).toContain("Patrick Mahomes");
});

test("a string ariaLabel is a column name (Plot's channel): each image reads its row's value, not the string", () => {
  const svg = Plot.plot({
    marks: [logos(STANDINGS, { league: "nfl", x: "wins", y: "pf", team: "team", ariaLabel: "qb" })],
  });
  const labels = Array.from(svg.querySelectorAll("image"), (i) => i.getAttribute("aria-label"));
  expect(labels).toEqual(STANDINGS.map((s) => s.qb));
});

test("dodge's r below half the drawn height overlaps the logos, by design: never clipped, never shrunk", () => {
  const frame = 240 - 20 - 30;
  const height = 0.12;
  const r = 4; // well under half the drawn height (11.4 px)
  const svg = Plot.plot({
    height: 240,
    width: 760,
    marginTop: 20,
    marginBottom: 30,
    marks: [logos(TEAMS, Plot.dodgeY({ league: "nfl", team: "team", x: "net", r, height }))],
  });
  const imgs = Array.from(svg.querySelectorAll("image"));
  expect(imgs).toHaveLength(32);
  expect(imgs.every((i) => i.getAttribute("clip-path") === null)).toBe(true);
  expect(imgs.every((i) => Math.abs(box(i).h - height * frame) < 1e-9)).toBe(true);
  const c = imgs.map(centreOf);
  let min = Number.POSITIVE_INFINITY;
  for (let a = 0; a < c.length; a++)
    for (let b = a + 1; b < c.length; b++) {
      const [ax, ay] = c[a] as [number, number];
      const [bx, by] = c[b] as [number, number];
      min = Math.min(min, Math.hypot(ax - bx, ay - by));
    }
  expect(min).toBeGreaterThanOrEqual(2 * r - 1e-6); // dodge still separates the centres by 2r
  expect(min).toBeLessThan(height * frame); // ...which is less than a logo: neighbours overlap
});

test("drawnMarks reports a Date x as its time in ms (Super Bowl LIX touchdowns by wall clock)", () => {
  const competitors = TDS.header.competitions[0]?.competitors ?? [];
  const abbr = new Map(competitors.map((c) => [c.team.id, c.team.abbreviation]));
  const tds = TDS.plays.map((p) => {
    const offense = p.teamParticipants.find((t) => t.type === "offense")?.id ?? "";
    return { at: new Date(p.wallclock), team: abbr.get(offense) ?? offense, lead: p.homeScore - p.awayScore };
  });
  expect(tds).toHaveLength(6);
  const svg = Plot.plot({ marks: [logos(tds, { league: "nfl", x: "at", y: "lead", team: "team" })] });
  const dm = drawnMarks(svg);
  expect(dm.map((m) => m.x)).toEqual(tds.map((t) => t.at.getTime()));
  expect(dm.map((m) => m.y)).toEqual(tds.map((t) => t.lead));
});

test("compose order: a caller's render wraps sdvplot's sizing (it sees the sized image) and Plot.pointer stays outermost", () => {
  const px = 0.2 * (400 - 20 - 30);
  // the caller's render records the height it sees after sdvplot's sizing has run
  const tag: Plot.RenderFunction = (index, scales, values, dimensions, context, next) => {
    const g = next?.(index, scales, values, dimensions, context) ?? null;
    for (const img of Array.from(g?.querySelectorAll("image") ?? []))
      img.setAttribute("data-caller-saw", img.getAttribute("height") ?? "");
    return g;
  };
  const o = { league: "nfl", x: "wins", y: "pf", team: "team", height: 0.2, render: tag } as const;
  const plain = Plot.plot({ width: 640, height: 400, marks: [logos(STANDINGS, o)] });
  const seen = Array.from(plain.querySelectorAll("image"), (i) => Number(i.getAttribute("data-caller-saw")));
  expect(seen.map((h) => h.toFixed(6))).toEqual(Array(8).fill(px.toFixed(6)));

  const svg = Plot.plot({ width: 640, height: 400, marks: [logos(STANDINGS, Plot.pointer(o))] });
  expect(svg.querySelectorAll("image")).toHaveLength(0); // the pointer draws nothing until pointed
  const [x, y] = centreOf(plain.querySelector('image[data-sdv-id="12"]') as Element);
  pointAt(svg, x, y);
  const shown = Array.from(svg.querySelectorAll("image"));
  expect(shown).toHaveLength(1);
  expect(shown[0]?.getAttribute("data-sdv-id")).toBe("12");
  expect(Number(shown[0]?.getAttribute("data-caller-saw"))).toBeCloseTo(px, 9);
});
