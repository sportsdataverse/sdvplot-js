// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { beforeAll, expect, test, vi } from "vitest";
import { STANDINGS, type Standing } from "../../../sdvtables/test/fixtures/standings.js";
import { loadLeague, resetWarnings, setWarningHandler } from "../../src/index.js";
import { linkSelection } from "../../src/interact/index.js";
import { axisLogos, linkIds } from "../../src/plot/index.js";
import { createSelection } from "../../src/selection.js";
import { BKN } from "../shots/fixture.js";

beforeAll(() => loadLeague("nfl"));
// jsdom has no layout: Plot's tip measures its text with getBBox a frame after it draws (tip.js postrender)
Object.defineProperty(SVGElement.prototype, "getBBox", {
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
});

// 2024 AFC: wins x net EPA/play. NE's net_epa is null, so NE has no dot.
const scatter = (o: { tip?: Plot.MarkOptions["tip"]; href?: boolean } = {}): ReturnType<typeof Plot.plot> =>
  Plot.plot({
    width: 640,
    height: 400,
    x: { domain: [0, 17] },
    y: { domain: [-0.2, 0.2] },
    marks: [
      Plot.dot(STANDINGS, {
        x: "wins",
        y: "net_epa",
        r: 6,
        ...(o.tip !== undefined && { tip: o.tip }),
        ...(o.href === true && { href: (d: Standing) => `#${d.team}` }),
        render: linkIds(STANDINGS, "team"),
      }),
    ],
  });
const lit = (root: Element): (string | null)[] =>
  Array.from(root.querySelectorAll(".sdv-hl")).map((e) => e.getAttribute("data-sdv-id"));
const over = (el: Element | null | undefined): void => {
  el?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
};
const hover = (store: ReturnType<typeof createSelection<Standing>>): string[] => [...store.getState().hover];
/**
 * A pointer event at data coordinates, offset by `dx` pixels (jsdom has no layout: Plot reads clientX/Y as svg
 * pixels). jsdom 26 has no PointerEvent and Plot's pointer reads `pointerType`, so it is defined on a MouseEvent.
 */
const pointer = (
  svg: ReturnType<typeof Plot.plot>,
  type: string,
  x: number,
  y: number,
  dx = 0,
): MouseEvent => {
  const e = new MouseEvent(type, {
    clientX: Number(svg.scale("x")?.apply(x)) + dx,
    clientY: Number(svg.scale("y")?.apply(y)),
  });
  Object.defineProperty(e, "pointerType", { value: "mouse" });
  return e;
};
const byTeam = (d: Standing): string => d.team;

test("a figure mark hover writes store.hover; moving off every mark or leaving the figure clears it", () => {
  const svg = scatter();
  const store = createSelection<Standing>();
  linkSelection(store, { plot: svg });
  over(svg.querySelector('[data-sdv-id="LV"]'));
  expect(hover(store)).toEqual(["LV"]);
  expect(lit(svg)).toEqual(["LV"]);
  over(svg.querySelector('g[aria-label="x-axis tick"]')); // not a stamped mark
  expect(hover(store)).toEqual([]);
  over(svg.querySelector('[data-sdv-id="BUF"]'));
  svg.dispatchEvent(new MouseEvent("mouseleave"));
  expect(hover(store)).toEqual([]);
  expect(svg.classList.contains("sdv-focus")).toBe(false);
});
test("an axis logo is never a hover target: it carries an ESPN id, but it is a decoration (A39)", () => {
  const svg = Plot.plot({
    marks: [
      Plot.barY(STANDINGS, { x: "team", y: "wins", render: linkIds(STANDINGS, "team") }),
      axisLogos("x", { league: "nfl" }),
    ],
  });
  const store = createSelection<Standing>();
  linkSelection(store, { plot: svg });
  const kcLogo = svg.querySelector('image[data-sdv-axis][data-sdv-id="12"]'); // KC's ESPN id
  expect(kcLogo).not.toBeNull();
  over(kcLogo);
  expect(hover(store)).toEqual([]);
  over(svg.querySelector('rect[data-sdv-id="KC"]'));
  expect(hover(store)).toEqual(["KC"]);
});
test("a mark wrapped in <a href> hovers by its stamp on the <a> (closest matches the element itself, A38)", () => {
  const svg = scatter({ href: true });
  const a = svg.querySelector('a[data-sdv-id="DEN"]');
  expect(a?.getAttribute("href")).toBe("#DEN"); // linkIds stamped the <a>, not the circle inside it
  const store = createSelection<Standing>();
  linkSelection(store, { plot: svg });
  over(a?.querySelector("circle"));
  expect(hover(store)).toEqual(["DEN"]);
});
test("a Plot tip hover writes the store once per datum; leaving writes [] (A20)", () => {
  const svg = scatter({ tip: true });
  const store = createSelection<Standing>();
  const fn = vi.fn();
  store.subscribe(fn);
  linkSelection(store, { plot: svg, hover: { id: byTeam } });
  svg.dispatchEvent(pointer(svg, "pointermove", 15, 0.063, 4)); // 4 px right of KC's dot: the tip points at KC
  expect(hover(store)).toEqual(["KC"]);
  svg.dispatchEvent(pointer(svg, "pointermove", 15, 0.063, -3)); // still nearest KC: no new datum, no update
  expect(fn).toHaveBeenCalledTimes(1);
  svg.dispatchEvent(pointer(svg, "pointermove", 13, 0.19)); // BUF
  expect(hover(store)).toEqual(["BUF"]);
  expect(lit(svg)).toEqual(["BUF"]);
  svg.dispatchEvent(pointer(svg, "pointerleave", 13, 0.19));
  expect(hover(store)).toEqual([]);
  expect(fn).toHaveBeenCalledTimes(3);
});
test("with hover: { id }, a mouseover writes nothing: Plot's pointer is the one hover writer (A20)", () => {
  const svg = scatter({ tip: true });
  const store = createSelection<Standing>();
  linkSelection(store, { plot: svg, hover: { id: byTeam } });
  const fn = vi.fn();
  store.subscribe(fn);
  over(svg.querySelector('circle[data-sdv-id="LV"]')); // a mouseover alone: Plot's pointer saw no pointermove
  expect(fn).not.toHaveBeenCalled();
  svg.dispatchEvent(new MouseEvent("mouseleave"));
  expect(fn).not.toHaveBeenCalled();
  store.set({ selected: ["LV"] }); // the store still drives the figure
  expect(lit(svg)).toEqual(["LV"]);
});
test("nearest within a radius (Review Focus 9): tip maxRadius 18 hovers a dot 17 px away; 19 px away clears", () => {
  const svg = scatter({ tip: { maxRadius: 18 } });
  const store = createSelection<Standing>();
  linkSelection(store, { plot: svg, hover: { id: byTeam } });
  svg.dispatchEvent(pointer(svg, "pointermove", 15, 0.063, 17)); // KC's nearest neighbour, BUF, is ~70 px away
  expect(hover(store)).toEqual(["KC"]);
  svg.dispatchEvent(pointer(svg, "pointermove", 15, 0.063, 19));
  expect(hover(store)).toEqual([]);
});
test("a captioned figure: Plot dispatches input on the <figure> it returns, and linking that figure works (A34)", () => {
  const fig = Plot.plot({
    caption: "2024 AFC: wins and net EPA per play",
    width: 640,
    height: 400,
    x: { domain: [0, 17] },
    y: { domain: [-0.2, 0.2] },
    marks: [
      Plot.dot(STANDINGS, { x: "wins", y: "net_epa", r: 6, tip: true, render: linkIds(STANDINGS, "team") }),
    ],
  });
  expect(fig.tagName.toLowerCase()).toBe("figure");
  const store = createSelection<Standing>();
  linkSelection(store, { plot: fig, hover: { id: byTeam } });
  fig.querySelector("svg")?.dispatchEvent(pointer(fig, "pointermove", 15, 0.063, 4)); // Plot listens on the svg
  expect(hover(store)).toEqual(["KC"]);
  expect(lit(fig)).toEqual(["KC"]);
});
test("hover: false attaches no hover writer; the store still drives the figure (A5)", () => {
  const svg = scatter();
  const store = createSelection<Standing>();
  linkSelection(store, { plot: svg, hover: false });
  over(svg.querySelector('[data-sdv-id="LV"]'));
  expect(store.getState().hover.size).toBe(0);
  store.set({ hover: ["MIA"] });
  expect(lit(svg)).toEqual(["MIA"]);
});
test("2,000 BKN shots: a hover moving shot to shot changes 2 attributes and adds or removes no node (Review Focus 4)", () => {
  const svg = Plot.plot({
    marks: [Plot.dot(BKN, { x: "x_legacy", y: "y_legacy", r: 2, render: linkIds(BKN) })],
  });
  expect(svg.querySelectorAll("circle[data-sdv-id]")).toHaveLength(2000);
  const store = createSelection();
  linkSelection(store, { plot: svg });
  over(svg.querySelector('[data-sdv-id="0"]'));
  const mo = new MutationObserver(() => {});
  mo.observe(svg, { attributes: true, childList: true, subtree: true });
  over(svg.querySelector('[data-sdv-id="1"]'));
  const records = mo.takeRecords();
  expect(records.map((r) => r.type)).toEqual(["attributes", "attributes"]);
  expect(lit(svg)).toEqual(["1"]);
});
test("teardown removes the figure's hover listeners and its store subscription", () => {
  const svg = scatter();
  const store = createSelection<Standing>();
  const off = linkSelection(store, { plot: svg });
  off();
  over(svg.querySelector('[data-sdv-id="LV"]'));
  expect(store.getState().hover.size).toBe(0);
  store.set({ selected: ["KC"] });
  expect(lit(svg)).toEqual([]);
});
test("a stamped element around the figure is never read as a mark: closest(MARK) stops at the figure", () => {
  const svg = scatter();
  const outer = document.createElement("div");
  outer.setAttribute("data-sdv-id", "AFC"); // e.g. a stamped mark of an outer chart
  outer.append(svg);
  const store = createSelection<Standing>();
  linkSelection(store, { plot: svg, select: "toggle" });
  const tick = svg.querySelector('g[aria-label="x-axis tick"]'); // inside the figure, not a mark
  over(tick);
  expect(hover(store)).toEqual([]);
  tick?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(store.getState().selected.size).toBe(0);
});
test("a join-key mismatch warns once per figure, not once per hovered id", () => {
  const warnings: string[] = [];
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
  try {
    const store = createSelection<Standing>();
    linkSelection(store, { plot: scatter() });
    for (const id of ["12", "4", "15"]) store.set({ hover: [id] }); // ESPN team ids against abbreviation stamps
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("none of the linked ids (12) is drawn"); // the first miss names its id
    linkSelection(store, { plot: scatter() }); // another figure with the same mismatch gets its own warning
    store.set({ hover: ["26"] });
    expect(warnings).toHaveLength(2);
    expect(warnings[1]).toContain("(15)"); // the store's hover when that figure linked
  } finally {
    setWarningHandler(null);
  }
});
