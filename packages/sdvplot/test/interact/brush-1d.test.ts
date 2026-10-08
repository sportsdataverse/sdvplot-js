// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { brushSelection, scaleUtc, select } from "d3";
import { expect, test, vi } from "vitest";
import { InputError } from "../../src/errors.js";
import { type BrushFilterOptions, brushFilter, hasDom } from "../../src/interact/index.js";
import { linkIds } from "../../src/plot/index.js";
import { createSelection, focusIds } from "../../src/selection.js";
import { BKN_GAMES, type BknGame } from "../shots/fixture.js";

// BKN's 24 games of the vendored shots (blazing-the-nets game_logs_2026_bkn.parquet), on main's timeline: a UTC date
// axis with one tick per game (main lib/charts/timeline.ts:26, :76-92).
const utc = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const day = (g: BknGame): Date => utc(g.game_date);
const NOV = [utc("2025-11-01"), utc("2025-11-06")] as const; // PHI 11-02, MIN 11-03, IND 11-05; 10-29 and 11-07 outside
const THREE = ["0022500149", "0022500156", "0022500173"];
const GAP = [utc("2025-12-08"), utc("2025-12-16")] as const; // strictly between NOP 12-06 and MIA 12-18: no game

const timeline = (): ReturnType<typeof Plot.plot> =>
  Plot.plot({
    width: 640,
    height: 80,
    x: { type: "utc" },
    marks: [Plot.tickX(BKN_GAMES, { x: day, render: linkIds(BKN_GAMES, "game_id") })],
  });
const setup = (o: Partial<BrushFilterOptions<BknGame>> = {}) => {
  const svg = timeline();
  const store = createSelection<BknGame>();
  const brush = brushFilter(svg, store, { data: BKN_GAMES, x: day, id: "game_id", ...o });
  const node = svg.querySelector<SVGGElement>(".sdv-brush");
  if (node === null) throw new Error("no brush overlay");
  return { svg, store, brush, node };
};
const passing = (s: ReturnType<typeof createSelection<BknGame>>): string[] =>
  BKN_GAMES.filter((g) => s.getState().predicate?.(g)).map((g) => g.game_id);

/** A mouse event whose `view` is the window: d3-brush listens for the drag and the release there (brush.test.ts). */
const mouse = (type: string, clientX: number): MouseEvent => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY: 40 });
  Object.defineProperty(e, "view", { value: window });
  return e;
};
/** A plain click on the overlay: a press and a release at one point, so d3-brush ends with an empty selection. */
const click = (overlay: Element | null, clientX: number): void => {
  overlay?.dispatchEvent(mouse("mousedown", clientX));
  window.dispatchEvent(mouse("mouseup", clientX));
};

test("brushX: a window over three game dates selects exactly those three games in one update", () => {
  const { svg, store, brush, node } = setup();
  const fn = vi.fn();
  store.subscribe(fn);
  brush.move({ x: NOV });
  expect(fn).toHaveBeenCalledTimes(1);
  expect([...store.getState().selected]).toEqual(THREE);
  expect(passing(store)).toEqual(THREE); // the predicate tests the date alone: the figure has no y
  expect(brushSelection(node)).toHaveLength(2); // 1-D: [x0, x1] in pixels
  const overlay = node.querySelector(".overlay");
  expect(overlay?.getAttribute("y")).toBe("0"); // the extent spans the svg's height
  expect(overlay?.getAttribute("height")).toBe(svg.getAttribute("height"));
  const rect = node.querySelector(".selection"); // the drawn window: a vertical band, full height
  expect([rect?.getAttribute("y"), rect?.getAttribute("height")]).toEqual(["0", "80"]);
  expect(Number(rect?.getAttribute("width"))).toBeGreaterThan(0);
  expect(() => brush.move({ y: NOV })).toThrow(InputError); // an x brush moves along x
});
test("brushY: a y-only brush is the transpose, over the full svg width", () => {
  const svg = Plot.plot({
    width: 80,
    height: 400,
    y: { type: "utc" },
    marks: [Plot.tickY(BKN_GAMES, { y: day, render: linkIds(BKN_GAMES, "game_id") })],
  });
  const store = createSelection<BknGame>();
  brushFilter(svg, store, { data: BKN_GAMES, y: day, id: "game_id" }).move({ y: NOV });
  expect([...store.getState().selected]).toEqual(THREE);
  expect(passing(store)).toEqual(THREE);
  const overlay = svg.querySelector(".sdv-brush .overlay");
  expect(overlay?.getAttribute("x")).toBe("0");
  expect(overlay?.getAttribute("width")).toBe("80");
  const rect = svg.querySelector(".sdv-brush .selection"); // a horizontal band, full width
  expect([rect?.getAttribute("x"), rect?.getAttribute("width")]).toEqual(["0", "80"]);
  expect(Number(rect?.getAttribute("height"))).toBeGreaterThan(0);
});
test("empty 'clear': a window strictly between two game days removes the drawn brush and leaves the store idle; 'dim' dims", () => {
  const { store, brush, node } = setup({ empty: "clear" });
  const fn = vi.fn();
  store.subscribe(fn);
  brush.move({ x: NOV });
  expect(fn).toHaveBeenCalledTimes(1);
  brush.move({ x: GAP }); // main timeline.ts:35-43: left drawn, it would look applied while every game counts
  expect(brushSelection(node)).toBeNull();
  expect(store.getState().predicate).toBeNull();
  expect(focusIds(store.getState())).toBeNull();
  expect(fn).toHaveBeenCalledTimes(2); // ONE update: the region's clear; erasing the rectangle writes nothing
  const idle = setup({ empty: "clear" });
  const quiet = vi.fn();
  idle.store.subscribe(quiet);
  idle.brush.move({ x: GAP }); // a brush that owned nothing writes nothing
  expect(brushSelection(idle.node)).toBeNull();
  expect(quiet).not.toHaveBeenCalled();
  // the default "dim" (Review Focus 2): the same window stays drawn and dims every game
  const dim = setup();
  dim.brush.move({ x: GAP });
  expect(brushSelection(dim.node)).not.toBeNull();
  expect(dim.store.getState().selected.size).toBe(0);
  expect(passing(dim.store)).toEqual([]);
  expect(focusIds(dim.store.getState())).toEqual(new Set());
});
test("an external store.clear() removes the drawn brush with no second notification (Review Focus 11)", () => {
  const { store, brush, node } = setup();
  const fn = vi.fn();
  store.subscribe(fn);
  brush.move({ x: NOV });
  expect(brushSelection(node)).not.toBeNull();
  store.clear(); // main's "Clear dates" button (components/PlayerExplorer.tsx:120-124)
  expect(brushSelection(node)).toBeNull();
  expect(fn).toHaveBeenCalledTimes(2);
  expect(store.getState().predicate).toBeNull();
  // a predicate set elsewhere replaces the brush's region: the rectangle goes too, and the brush writes nothing
  brush.move({ x: NOV });
  const wins = (g: BknGame): boolean => g.wl === "W";
  store.set({ predicate: wins });
  expect(brushSelection(node)).toBeNull();
  expect(store.getState().predicate).toBe(wins);
  expect(fn).toHaveBeenCalledTimes(4);
});
test("destroy stops following the store", () => {
  const svg = timeline();
  const store = createSelection<BknGame>();
  const unsubscribed = vi.fn();
  const spy: typeof store = {
    ...store,
    subscribe: (fn) => {
      const off = store.subscribe(fn);
      return () => {
        unsubscribed();
        off();
      };
    },
  };
  const brush = brushFilter(svg, spy, { data: BKN_GAMES, x: day, id: "game_id" });
  brush.move({ x: NOV });
  brush.destroy();
  expect(unsubscribed).toHaveBeenCalledTimes(1);
  expect(svg.querySelector(".sdv-brush")).toBeNull();
  expect(store.getState().predicate).toBeNull();
});
test("a click on the empty chart clears the brush's own region only: a selection made elsewhere survives (main)", () => {
  const { svg, store, brush, node } = setup();
  const overlay = node.querySelector(".overlay");
  const at = (d: Date): number => Number(svg.scale("x")?.apply(d));
  const fn = vi.fn();
  store.subscribe(fn);
  store.set({ selected: ["0022500373"] }); // a toggled cell or a table row picked the Dec 18 game
  click(overlay, at(utc("2025-11-20")));
  expect([...store.getState().selected]).toEqual(["0022500373"]); // main: the timeline never touches the game picks
  expect(fn).toHaveBeenCalledTimes(1);
  brush.move({ x: NOV });
  expect(fn).toHaveBeenCalledTimes(2);
  click(overlay, at(utc("2025-12-10"))); // outside the drawn window: main clears its date window (timeline.ts:40)
  expect(brushSelection(node)).toBeNull();
  expect(focusIds(store.getState())).toBeNull();
  expect(fn).toHaveBeenCalledTimes(3);
});
test("the scales option brushes a d3-drawn svg with no figure.scale: main's timeline, a d3 scaleUtc (range() a method)", () => {
  // main lib/charts/timeline.ts:76-92, drawn with d3 as main draws it, each tick stamped with its game id
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 640 76");
  const first = BKN_GAMES[0] as BknGame;
  const last = BKN_GAMES.at(-1) as BknGame;
  const x = scaleUtc()
    .domain([day(first).getTime() - 86_400_000, day(last).getTime() + 86_400_000])
    .range([10, 630]);
  select(svg)
    .append("g")
    .selectAll("rect")
    .data(BKN_GAMES)
    .join("rect")
    .attr("x", (g) => x(day(g)) - 1.5)
    .attr("width", 3)
    .attr("y", 6)
    .attr("height", 48)
    .attr("data-sdv-id", (g) => g.game_id);
  const store = createSelection<BknGame>();
  brushFilter(svg, store, { data: BKN_GAMES, x: day, id: "game_id", scales: { x } }).move({ x: NOV });
  expect([...store.getState().selected]).toEqual(THREE);
  expect(passing(store)).toEqual(THREE);
  const overlay = svg.querySelector(".sdv-brush .overlay");
  expect([overlay?.getAttribute("x"), overlay?.getAttribute("width")]).toEqual(["10", "620"]); // x.range()
  expect(overlay?.getAttribute("height")).toBe("76"); // the viewBox height
});
test("no x and no y, or a brushed axis with no invertible scale, throws InputError, in Node too", () => {
  const svg = timeline();
  const bare = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const store = createSelection<BknGame>();
  vi.stubGlobal("window", undefined);
  try {
    expect(hasDom()).toBe(false);
    expect(() => brushFilter(svg, store, { data: BKN_GAMES })).toThrow(InputError);
    expect(() => brushFilter(svg, store, { data: BKN_GAMES, y: day })).toThrow(InputError); // tickX: no y scale
    expect(() => brushFilter(bare, store, { data: BKN_GAMES, x: day })).toThrow(InputError); // d3 svg, no `scales`
    const node = brushFilter(svg, store, { data: BKN_GAMES, x: day });
    node.move({ x: NOV }); // a no-op handle without a DOM
    expect(store.getState().predicate).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});
