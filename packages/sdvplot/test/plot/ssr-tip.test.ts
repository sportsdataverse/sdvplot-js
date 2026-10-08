// @vitest-environment node
// Phase 11 (J40): tips and pointers render nothing server-side and break nothing.
import * as Plot from "@observablehq/plot";
import { JSDOM } from "jsdom";
import { parseHTML } from "linkedom";
import { beforeAll, expect, test } from "vitest";
import { STANDINGS } from "../../../sdvtables/test/fixtures/standings.js";
import { loadLeague, setWarningHandler } from "../../src/index.js";
import { logos, shotCells, surface } from "../../src/plot/index.js";
import { cellsVsLeague, sizeCells } from "../../src/shots/index.js";
import { BKN, LEAGUE } from "../shots/fixture.js";

beforeAll(async () => {
  setWarningHandler(() => {});
  await loadLeague("nfl");
});
const chart = (document: Document, tip: boolean): string =>
  Plot.plot({ document, marks: [logos(STANDINGS, { league: "nfl", x: "wins", y: "pf", team: "team", tip })] })
    .outerHTML;
const EMPTY_TIP =
  '<g aria-label="tip" fill="var(--plot-background)" stroke="currentColor" pointer-events="none" text-anchor="start"></g>';

test("SSR: a tip adds exactly one empty <g aria-label=tip>; everything else is byte-identical", () => {
  expect(typeof window).toBe("undefined");
  const without = chart(new JSDOM("").window.document, false);
  const withTip = chart(new JSDOM("").window.document, true);
  expect(withTip.split(EMPTY_TIP)).toHaveLength(2);
  expect(withTip.replace(EMPTY_TIP, "")).toBe(without);
});

test("SSR: linkedom renders a tipped figure too", () => {
  const { document } = parseHTML("<!doctype html><html><body></body></html>");
  expect(chart(document as unknown as Document, true)).toMatch(/aria-label="tip"/);
});

test("SSR: shot cells with a tip render in Node (the cell centre anchors the tip)", () => {
  const cells = cellsVsLeague(BKN, LEAGUE.hex15);
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({
    document: new JSDOM("").window.document,
    ...court.scales,
    width: 500,
    marks: [...court.marks, shotCells(cells, { r: sizeCells(cells, { radius: 15 }).r, tip: true })],
  });
  expect(fig.outerHTML).toContain(EMPTY_TIP);
  expect(fig.querySelectorAll("path[data-sdv-id]")).toHaveLength(211);
});
