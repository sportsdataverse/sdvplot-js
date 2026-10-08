// @vitest-environment jsdom
// Phase 11 (J39, J41): the other Plot-facing exports pass Plot's options through and name what they draw.
import * as Plot from "@observablehq/plot";
import { surfaceMark } from "@sportsdataverse/sporty/plot";
import { beforeAll, expect, test } from "vitest";
import { STANDINGS } from "../../../sdvtables/test/fixtures/standings.js";
import { loadLeague, resolveSync } from "../../src/index.js";
import { axisLogos, logos, meanLines, surface, teamTiers, wordmarks } from "../../src/plot/index.js";
import { centreOf, pointAt, stubBBox, tipText } from "./_pointer.js";

beforeAll(async () => {
  stubBBox();
  await loadLeague("nfl");
});

test("meanLines: mark-level fx gives one mean per division; tip passes through", () => {
  const fig = Plot.plot({
    width: 640,
    height: 300,
    marks: [
      Plot.dot(STANDINGS, { x: "wins", y: "pf", fx: "division" }),
      ...meanLines(STANDINGS, { x: "wins", fx: "division", tip: true }),
    ],
  });
  const rules = fig.querySelectorAll("g[aria-label=rule] line");
  expect(rules).toHaveLength(2);
  // West's mean is 10 wins, East's 7.5: without fx each facet would draw the same overall mean (8.75)
  expect(new Set(Array.from(rules, (l) => l.getAttribute("x1"))).size).toBe(2);
  expect(fig.querySelectorAll("g[aria-label=tip]")).toHaveLength(1);
});

test("axisLogos: each image is named by the tick it replaces; Plot's axis options pass through", () => {
  const fig = Plot.plot({
    marks: [
      Plot.barY(STANDINGS, { x: "team", y: "wins" }),
      axisLogos("x", { league: "nfl", ariaDescription: "2024 AFC teams" }),
    ],
  });
  const labels = Array.from(fig.querySelectorAll("image")).map((i) => i.getAttribute("aria-label"));
  // a band scale sorts its domain, so the images follow the ticks alphabetically
  expect(labels).toEqual(["BUF", "DEN", "KC", "LAC", "LV", "MIA", "NE", "NYJ"].map((t) => `${t} logo`));
  expect(fig.querySelector("g[aria-description='2024 AFC teams']")).not.toBeNull();
  // a wordmark axis names its images by the mark type
  const wm = Plot.plot({
    marks: [
      Plot.barX(STANDINGS, { y: "team", x: "wins" }),
      axisLogos("y", { league: "nfl", markType: "wordmark" }),
    ],
  });
  expect(wm.querySelector("image")?.getAttribute("aria-label")).toBe("BUF wordmark");
});

test("axisLogos: categories keyed by team_id name each image by the team, not the id", () => {
  const ids = resolveSync(
    STANDINGS.map((r) => r.team),
    "nfl",
  );
  const rows = STANDINGS.map((r, i) => ({ team_id: ids[i], wins: r.wins }));
  const fig = Plot.plot({
    marks: [
      Plot.barY(rows, { x: "team_id", y: "wins" }),
      axisLogos("x", { league: "nfl", idSystem: "team_id" }),
    ],
  });
  const names = Array.from(fig.querySelectorAll("image"), (i) => i.getAttribute("aria-label"));
  expect(names.sort()).toEqual(STANDINGS.map((r) => `${r.team} logo`).sort());
});

test("axisLogos composes a caller's render (it wraps sdvplot's and sees the images), never replaces it", () => {
  const seen: number[] = [];
  const render: Plot.RenderFunction = (index, scales, values, dimensions, context, next) => {
    const g = next?.(index, scales, values, dimensions, context) ?? null;
    if (g?.querySelector("text, image")) seen.push(g.querySelectorAll("image").length); // the tick-label sub-mark
    g?.setAttribute("data-caller", "yes");
    return g;
  };
  const fig = Plot.plot({
    marks: [Plot.barY(STANDINGS, { x: "team", y: "wins" }), axisLogos("x", { league: "nfl", render })],
  });
  expect(fig.querySelectorAll("image")).toHaveLength(8); // sdvplot's swap still ran
  expect(seen).toEqual([8]);
  expect(fig.querySelector("[data-caller=yes] image")).not.toBeNull();
});

test("axisLogos: a caller's margin on the anchored side (or all sides) wins over the computed one", () => {
  const frameBottom = (o: Parameters<typeof axisLogos>[1]): number => {
    const svg = Plot.plot({ marks: [Plot.barY(STANDINGS, { x: "team", y: "wins" }), axisLogos("x", o)] });
    const rect = svg.querySelector("rect") as Element;
    return (
      Number(svg.getAttribute("height")) -
      Number(rect.getAttribute("y")) -
      Number(rect.getAttribute("height"))
    );
  };
  expect(frameBottom({ league: "nfl" })).toBe(Math.round(0.1 * 400) + 6 + 8); // the computed margin
  expect(frameBottom({ league: "nfl", marginBottom: 80 })).toBe(80);
  expect(frameBottom({ league: "nfl", margin: 70 })).toBe(70);
});

test("logos / wordmarks keyed by team_id are named by the resolved team, not the id; a caller's ariaLabel wins", () => {
  const ids = resolveSync(
    STANDINGS.map((r) => r.team),
    "nfl",
  );
  const rows = STANDINGS.map((r, i) => ({ team_id: ids[i], wins: r.wins, pf: r.pf }));
  expect(rows[0]?.team_id).toBe("12"); // KC's team_id: the key really is an id
  const o = { league: "nfl", x: "wins", y: "pf", team: "team_id", idSystem: "team_id" } as const;
  const names = (m: Plot.Markish): (string | null)[] =>
    Array.from(Plot.plot({ marks: [m] }).querySelectorAll("image"), (i) => i.getAttribute("aria-label"));
  expect(names(logos(rows, o))).toEqual(STANDINGS.map((r) => `${r.team} logo`));
  expect(names(wordmarks(rows, o))[0]).toBe("KC wordmark");
  expect(
    names(logos(rows, { ...o, ariaLabel: (_d: unknown, i: number) => STANDINGS[i]?.qb })).slice(0, 2),
  ).toEqual(["Patrick Mahomes", "Justin Herbert"]);
});

test("logos keyed by team_id: the default tip names the team as the image does ('KC'), not by its id ('12')", () => {
  const ids = resolveSync(
    STANDINGS.map((r) => r.team),
    "nfl",
  );
  const rows = STANDINGS.map((r, i) => ({ team_id: ids[i], wins: r.wins, pf: r.pf }));
  const fig = Plot.plot({
    width: 640,
    height: 400,
    marks: [
      logos(rows, { league: "nfl", x: "wins", y: "pf", team: "team_id", idSystem: "team_id", tip: true }),
    ],
  });
  const kc = fig.querySelector('image[data-sdv-id="12"]') as Element;
  expect(kc.getAttribute("aria-label")).toBe("KC logo");
  const [x, y] = centreOf(kc);
  pointAt(fig, x, y);
  expect(tipText(fig)).toMatch(/team\s*KC/);
  expect(tipText(fig)).not.toMatch(/team\s*12/);
  expect((fig as unknown as { value: { team_id: string } }).value.team_id).toBe("12"); // the row is the caller's
});

test("a league with no abbreviations (soccer) names each image, and its tip, by the team's full name, not its id", async () => {
  await loadLeague("soccer");
  // ESPN soccer team_ids; every soccer team in the index has a null abbreviation
  const rows = [
    { team_id: "359", x: 1, y: 1 },
    { team_id: "364", x: 2, y: 2 },
    { team_id: "478", x: 3, y: 3 },
  ];
  const fig = Plot.plot({
    marks: [
      logos(rows, { league: "soccer", x: "x", y: "y", team: "team_id", idSystem: "team_id", tip: true }),
    ],
  });
  const names = Array.from(fig.querySelectorAll("image"), (i) => i.getAttribute("aria-label"));
  expect(names).toEqual(["Arsenal logo", "Liverpool logo", "France logo"]);
  const [x, y] = centreOf(fig.querySelector('image[data-sdv-id="478"]') as Element);
  pointAt(fig, x, y);
  expect(tipText(fig)).toMatch(/team\s*France/);
});

test("teamTiers: tip names the team; the figure is labelled by its title", () => {
  const rows = STANDINGS.map((r) => ({ team: r.team, tier_no: r.wins >= 13 ? 1 : r.wins >= 8 ? 2 : 3 }));
  const fig = Plot.plot(teamTiers(rows, { league: "nfl", title: "2024 AFC tiers", tip: true }));
  const svg = fig.querySelector("svg") ?? fig;
  expect(svg.getAttribute("aria-label")).toBe("2024 AFC tiers");
  // the logos are named by team abbreviation (teamTiers keys them by team_id)
  const names = Array.from(fig.querySelectorAll("image"), (i) => i.getAttribute("aria-label"));
  expect(names.sort()).toEqual(STANDINGS.map((r) => `${r.team} logo`).sort());
  const img = fig.querySelector("image") as Element;
  const [x, y] = centreOf(img);
  pointAt(svg, x, y);
  expect(tipText(fig)).toMatch(/^​?(KC|BUF)$/); // tier 1, ranked: the first image drawn
});

test("surface: the court's polygons carry an aria-description", () => {
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({ ...court.scales, marks: court.marks });
  expect(fig.querySelector("g[aria-label=geo][aria-description]")?.getAttribute("aria-description")).toBe(
    "nba basketball surface",
  );
  // a caller's description replaces the default
  const own = Plot.plot({
    ...court.scales,
    marks: surfaceMark(court.scene, { ariaDescription: "half court, defensive end" }),
  });
  expect(own.querySelector("g[aria-label=geo][aria-description]")?.getAttribute("aria-description")).toBe(
    "half court, defensive end",
  );
});
