// @vitest-environment node
import * as Plot from "@observablehq/plot";
import { basketballCourt, toSurfaceFrame } from "@sportsdataverse/sporty";
import { surfaceMark, surfaceScales } from "@sportsdataverse/sporty/plot";
import { JSDOM } from "jsdom";
import { parseHTML } from "linkedom";
import { beforeAll, expect, test } from "vitest";
import { loadLeague, resetWarnings, setWarningHandler } from "../../src/index.js";
import { axisLogos, logos, surface, teamColor } from "../../src/plot/index.js";

const shots = toSurfaceFrame(
  [
    { x_legacy: 10, y_legacy: 120, team: "LAL", made: true },
    { x_legacy: -50, y_legacy: 230, team: "BOS", made: false },
  ],
  { from: "nba-legacy" },
);
beforeAll(async () => {
  setWarningHandler(() => {});
  resetWarnings();
  await loadLeague("nba");
  await loadLeague("nfl");
}, 60_000);

function chart(document: Document) {
  const court = surface("nba", { team: "LAL", displayRange: "defense" });
  return Plot.plot({
    document,
    ...court.scales,
    width: 940,
    color: teamColor("nba", { values: shots.map((s) => s.team) }),
    marks: [
      ...court.marks,
      Plot.dot(shots, { x: "surface_x", y: "surface_y", fill: "team", r: 5 }),
      logos(shots, { league: "nba", x: "surface_x", y: "surface_y", team: "team", height: 0.08 }),
    ],
  });
}
test("jsdom document → SVG string with archive-URL <image href=…> and court paths", () => {
  expect(typeof window).toBe("undefined");
  const s = chart(new JSDOM("").window.document).outerHTML;
  expect(s).toMatch(/^<svg/);
  expect(s).toMatch(/<image[^>]+href="https:\/\/sdv\.nyc3\.cdn\.digitaloceanspaces\.com\//);
  expect(s).toMatch(/<image[^>]+data-sdv-id/);
  expect(s).toMatch(/<path/);
  expect(s).not.toMatch(/NaN/);
});
test("linkedom document produces the same image hrefs", () => {
  const { document } = parseHTML("<!doctype html><html><body></body></html>");
  const a = chart(new JSDOM("").window.document).outerHTML.match(/href="[^"]+"/g);
  const b = chart(document as unknown as Document).outerHTML.match(/href="[^"]+"/g);
  expect(a?.length).toBeGreaterThan(0);
  expect(b).toEqual(a);
});
test("a standings bar chart with axis logos renders in Node", () => {
  const standings = [
    { team: "KC", wins: 14 },
    { team: "BUF", wins: 11 },
    { team: "NYJ", wins: 7 },
  ];
  const fig = Plot.plot({
    document: new JSDOM("").window.document,
    height: 300,
    marks: [
      Plot.barY(standings, { x: "team", y: "wins", fill: "team" }),
      axisLogos("x", { league: "nfl", height: 0.12 }),
    ],
    color: teamColor("nfl", { values: standings.map((s) => s.team) }),
  });
  expect((fig.outerHTML.match(/<image/g) ?? []).length).toBe(3);
});
test("sporty alone (no sdvplot) also renders a court in Node", () => {
  const court = basketballCourt("nba");
  expect(
    Plot.plot({ document: new JSDOM("").window.document, ...surfaceScales(court), marks: surfaceMark(court) })
      .outerHTML,
  ).toMatch(/<path/);
});
