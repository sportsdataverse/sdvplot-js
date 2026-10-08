// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { expect, test, vi } from "vitest";
import { STANDINGS, type Standing } from "../../../sdvtables/test/fixtures/standings.js";
import { InputError } from "../../src/errors.js";
import { linkSelection } from "../../src/interact/index.js";
import { linkIds } from "../../src/plot/index.js";
import { createSelection } from "../../src/selection.js";
import { BKN_GAMES, type BknGame } from "../shots/fixture.js";

// main's game strip (lib/charts/gameStrip.ts:67-122): one cell per BKN game in date order, each cell a checkbox
const strip = (href = false): ReturnType<typeof Plot.plot> =>
  Plot.plot({
    width: 640,
    height: 60,
    x: { type: "band" }, // the dates are ordinal cells, as main lays them out
    marks: [
      Plot.cell(BKN_GAMES, {
        x: "game_date",
        fill: "wl",
        ...(href && { href: (g: BknGame) => `#${g.game_id}` }),
        render: linkIds(BKN_GAMES, "game_id"),
      }),
    ],
  });
const PHI = "0022500149"; // 2025-11-02
const MIN = "0022500156"; // 2025-11-03
const IND = "0022500173"; // 2025-11-05, a win
const cell = (svg: Element, id: string): Element | null => svg.querySelector(`[data-sdv-id="${id}"]`);
const click = (el: Element | null): void => {
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};
const key = (el: Element | null, k: string): KeyboardEvent => {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
  el?.dispatchEvent(e);
  return e;
};
const checked = (svg: Element): string[] =>
  Array.from(svg.querySelectorAll('[aria-checked="true"]')).map((e) => e.getAttribute("data-sdv-id") ?? "");
const selected = (s: ReturnType<typeof createSelection<BknGame>>): string[] => [...s.getState().selected];

test("a click toggles the game in selected, a second click restores it, one update each", () => {
  const svg = strip();
  const store = createSelection<BknGame>();
  linkSelection(store, { figure: svg, select: "toggle" });
  const cells = Array.from(svg.querySelectorAll("[data-sdv-id]"));
  expect(cells).toHaveLength(24);
  for (const c of cells) {
    expect(c.getAttribute("role")).toBe("checkbox");
    expect(c.getAttribute("tabindex")).toBe("0");
    expect(c.getAttribute("aria-checked")).toBe("false");
  }
  const fn = vi.fn();
  store.subscribe(fn);
  click(cell(svg, PHI));
  expect(selected(store)).toEqual([PHI]);
  expect(fn).toHaveBeenCalledTimes(1);
  click(cell(svg, MIN));
  expect(selected(store)).toEqual([PHI, MIN]);
  click(cell(svg, PHI));
  expect(selected(store)).toEqual([MIN]);
  expect(fn).toHaveBeenCalledTimes(3);
  expect(checked(svg)).toEqual([MIN]);
});
test("Enter and Space toggle with preventDefault (Review Focus 11); other keys pass through", () => {
  const svg = strip();
  const store = createSelection<BknGame>();
  linkSelection(store, { figure: svg, select: "toggle" });
  const e1 = key(cell(svg, IND), "Enter");
  expect(e1.defaultPrevented).toBe(true);
  expect(selected(store)).toEqual([IND]);
  const e2 = key(cell(svg, IND), " "); // Space would otherwise scroll the page (main gameStrip.ts:53-59)
  expect(e2.defaultPrevented).toBe(true);
  expect(selected(store)).toEqual([]);
  const e3 = key(cell(svg, IND), "a");
  expect(e3.defaultPrevented).toBe(false);
  const e4 = key(svg, "Enter"); // not on a mark
  expect(e4.defaultPrevented).toBe(false);
  expect(selected(store)).toEqual([]);
});
test("aria-checked follows the store, including a change made elsewhere, touching only the changed marks", () => {
  const svg = strip();
  const store = createSelection<BknGame>();
  linkSelection(store, { figure: svg, select: "toggle" });
  const mo = new MutationObserver(() => {});
  mo.observe(svg, { attributes: true, attributeFilter: ["aria-checked"], subtree: true });
  const touched = (): string[] =>
    mo
      .takeRecords()
      .map(
        (r) =>
          `${(r.target as Element).getAttribute("data-sdv-id")}=${(r.target as Element).getAttribute("aria-checked")}`,
      )
      .sort();
  store.set({ selected: [PHI, MIN] }); // a table row click, a preset button: not this figure
  expect(touched()).toEqual([`${PHI}=true`, `${MIN}=true`]);
  store.set({ selected: [MIN, IND] });
  expect(touched()).toEqual([`${PHI}=false`, `${IND}=true`]);
  store.set({ hover: [IND] }); // a hover is not a selection
  expect(touched()).toEqual([]);
  store.clear();
  expect(touched()).toEqual([`${MIN}=false`, `${IND}=false`]);
  expect(checked(svg)).toEqual([]);
});
test("without select, marks get no role or tabindex, and a click writes nothing", () => {
  const svg = strip();
  const store = createSelection<BknGame>();
  linkSelection(store, { figure: svg });
  expect(svg.querySelectorAll("[role], [tabindex], [aria-checked]")).toHaveLength(0);
  click(cell(svg, PHI));
  expect(selected(store)).toEqual([]);
});
test("a mark inside <a href> throws InputError (A36): the guard matches the stamped <a> itself (A38), in Node too", () => {
  const svg = strip(true);
  const a = svg.querySelector(`a[data-sdv-id="${PHI}"]`);
  expect(a?.getAttribute("href")).toBe(`#${PHI}`); // linkIds stamped the <a>, not the rect inside it
  const store = createSelection<BknGame>();
  expect(() => linkSelection(store, { figure: svg, select: "toggle" })).toThrow(InputError);
  expect(svg.querySelectorAll("[role]")).toHaveLength(0);
  expect(() => linkSelection(store, { figure: svg })).not.toThrow(); // a link is fine without the toggle
  const plain = strip();
  const before = plain.outerHTML;
  vi.stubGlobal("window", undefined);
  try {
    expect(() => linkSelection(store, { figure: svg, select: "toggle" })).toThrow(InputError);
    expect(() => linkSelection(store, { select: "toggle" })).toThrow(InputError); // nothing to toggle
    linkSelection(store, { figure: plain, select: "toggle" })();
    expect(plain.outerHTML).toBe(before); // no DOM: nothing stamped, so a server string is unchanged
  } finally {
    vi.unstubAllGlobals();
  }
});
test("teardown removes the roles, the listeners and the store subscription", () => {
  const svg = strip();
  const store = createSelection<BknGame>();
  const off = linkSelection(store, { figure: svg, select: "toggle" });
  click(cell(svg, PHI));
  off();
  expect(svg.querySelectorAll("[role], [tabindex], [aria-checked]")).toHaveLength(0);
  click(cell(svg, MIN));
  expect(selected(store)).toEqual([PHI]);
  store.set({ selected: [IND] });
  expect(svg.querySelectorAll("[aria-checked]")).toHaveLength(0);
});
test("teardown restores each mark's own role, tabindex and aria-checked, and un-dims the strip", () => {
  const svg = strip();
  const phi = cell(svg, PHI);
  // a d3 strip whose cells began as buttons outside the tab order (a d3 chart's own a11y): unlinking gives them back
  phi?.setAttribute("role", "button");
  phi?.setAttribute("tabindex", "-1");
  phi?.setAttribute("aria-checked", "mixed");
  const store = createSelection<BknGame>();
  const off = linkSelection(store, { figure: svg, select: "toggle" });
  click(cell(svg, IND));
  expect([
    phi?.getAttribute("role"),
    phi?.getAttribute("tabindex"),
    svg.classList.contains("sdv-focus"),
  ]).toEqual(["checkbox", "0", true]);
  off();
  const attrs = (el: Element | null): (string | null)[] =>
    ["role", "tabindex", "aria-checked"].map((a) => el?.getAttribute(a) ?? null);
  expect(attrs(phi)).toEqual(["button", "-1", "mixed"]);
  expect(attrs(cell(svg, IND))).toEqual([null, null, null]);
  expect([svg.classList.contains("sdv-focus"), selected(store)]).toEqual([false, [IND]]); // the pick is the store's
});
test("each checkbox has an accessible name: its own aria-label or <title> when it has one, else its link id", () => {
  // Plot's ariaLabel channel names a mark through aria-label, its title channel through a <title> child; a mark with
  // neither would be an unnamed checkbox, so the toggle names it by its id until teardown
  const games = BKN_GAMES.slice(0, 3); // the first three games of the season
  const plot = (o: Plot.CellOptions) =>
    Plot.plot({
      width: 640,
      height: 60,
      x: { type: "band" },
      marks: [Plot.cell(games, { x: "game_date", fill: "wl", ...o, render: linkIds(games, "game_id") })],
    });
  const name = (m: Element): string | null =>
    m.getAttribute("aria-label") ?? m.querySelector(":scope > title")?.textContent ?? null;
  const ids = games.map((g) => g.game_id);
  const store = createSelection<BknGame>();
  const bare = plot({});
  const offBare = linkSelection(store, { figure: bare, select: "toggle" });
  const cells = (svg: Element): Element[] => Array.from(svg.querySelectorAll('[role="checkbox"]'));
  expect(cells(bare).map(name)).toEqual(ids);
  const labelled = plot({ ariaLabel: "matchup" });
  linkSelection(store, { figure: labelled, select: "toggle" });
  expect(cells(labelled).map(name)).toEqual(games.map((g) => g.matchup));
  const titled = plot({ title: "matchup" });
  linkSelection(store, { figure: titled, select: "toggle" });
  expect(cells(titled).map((m) => m.getAttribute("aria-label"))).toEqual([null, null, null]); // the <title> names it
  expect(cells(titled).map(name)).toEqual(games.map((g) => g.matchup));
  offBare();
  expect(ids.map((id) => cell(bare, id)?.getAttribute("aria-label") ?? null)).toEqual([null, null, null]); // added, removed
});
test("a mark stamped with an empty id (a missing key) is no checkbox and no hover target: it could never toggle", () => {
  // 2024 AFC, one cell per team, keyed by team only where the team has a net EPA: NE's is blanked, so its id is missing
  const svg = Plot.plot({
    width: 640,
    height: 60,
    x: { type: "band" },
    marks: [
      Plot.cell(STANDINGS, {
        x: "team",
        fill: "wins",
        render: linkIds(STANDINGS, (r: Standing) => (r.net_epa === null ? null : r.team)),
      }),
    ],
  });
  const ne = svg.querySelector('[data-sdv-id=""]');
  expect(ne).not.toBeNull(); // toId(null): the stamp a missing id gets
  const store = createSelection<Standing>();
  linkSelection(store, { figure: svg, select: "toggle" });
  expect(svg.querySelectorAll('[role="checkbox"]')).toHaveLength(7);
  expect(["role", "tabindex", "aria-checked"].map((a) => ne?.getAttribute(a) ?? null)).toEqual([
    null,
    null,
    null,
  ]);
  const fn = vi.fn();
  store.subscribe(fn);
  ne?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  click(ne);
  expect(key(ne, "Enter").defaultPrevented).toBe(false);
  expect(fn).not.toHaveBeenCalled(); // no "" hover dimming all eight cells, no selection
  click(cell(svg, "BUF")); // the keyed cells still toggle
  expect([...store.getState().selected]).toEqual(["BUF"]);
});
