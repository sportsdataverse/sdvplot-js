// @vitest-environment node
import * as Plot from "@observablehq/plot";
import { JSDOM } from "jsdom";
import { beforeAll, expect, test } from "vitest";
import { STANDINGS, type Standing } from "../../../sdvtables/test/fixtures/standings.js";
import { loadLeague } from "../../src/index.js";
import { brushFilter, highlight, linkSelection } from "../../src/interact/index.js";
import { linkIds, logos } from "../../src/plot/index.js";
import { createSelection } from "../../src/selection.js";

beforeAll(() => loadLeague("nfl"));
// The logos stamp resolved ESPN team ids; their `id` option (abbreviations) arrives with Phase 11's image marks (A27).
const chart = (): ReturnType<typeof Plot.plot> =>
  Plot.plot({
    document: new JSDOM("").window.document,
    x: { domain: [0, 17] },
    y: { domain: [-0.2, 0.2] },
    marks: [
      Plot.dot(STANDINGS, { x: "wins", y: "net_epa", tip: true, render: linkIds(STANDINGS, "team") }),
      logos(STANDINGS, { league: "nfl", x: "wins", y: "net_epa", team: "team", height: 0.06 }),
    ],
  });

test("SSR: the server string is byte-identical with or without a store (Review Focus 1, 12)", () => {
  expect(typeof window).toBe("undefined");
  const before = chart().outerHTML;
  const svg = chart();
  const store = createSelection<Standing>();
  store.set({ hover: ["BUF"], selected: ["KC"], predicate: (r) => r.wins > 10 }); // an ACTIVE store
  const off = linkSelection(store, { plot: svg });
  const offTip = linkSelection(store, { plot: svg, hover: { id: (d: Standing) => d.team } }); // A20's input path
  expect(highlight(svg, new Set(["KC"]))).toEqual([]);
  const brush = brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" });
  brush.move({ x: [9.5, 16], y: [0, 0.2] });
  brush.destroy();
  off();
  offTip();
  expect(svg.outerHTML).toBe(before);
  expect([...store.getState().selected]).toEqual(["KC"]); // the inert brush never wrote to the store
  expect(before).toContain('data-sdv-id="KC"'); // the stamps ARE server output: the client links to SSR markup
  expect(before).toContain('aria-label="tip"'); // and the tip's one empty group is there with or without a store
});
test("SSR: argument errors still throw in Node (a band scale cannot be brushed)", () => {
  const bars = Plot.plot({
    document: new JSDOM("").window.document,
    marks: [Plot.barY(STANDINGS, { x: "team", y: "wins" })],
  });
  expect(() =>
    brushFilter(bars, createSelection<Standing>(), { data: STANDINGS, x: "team", y: "wins" }),
  ).toThrow(/continuous x and y/);
});
