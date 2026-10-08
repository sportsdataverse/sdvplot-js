// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { create, scaleLinear } from "d3";
import { expect, test, vi } from "vitest";
import { STANDINGS, type Standing } from "../../../sdvtables/test/fixtures/standings.js";
import { type HoverPoint, linkSelection, nearestHover } from "../../src/interact/index.js";
import { linkIds } from "../../src/plot/index.js";
import { createSelection, toId } from "../../src/selection.js";
import { fgPctByDistance } from "../../src/shots/index.js";
import { BKN, type BknShot } from "../shots/fixture.js";

// jsdom has no layout: Plot's tip measures its text with getBBox a frame after it draws (tip.js postrender)
Object.defineProperty(SVGElement.prototype, "getBBox", {
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
});
// jsdom has no layout: d3.pointer falls back to clientX/Y minus a zero bounding box, so clientX/Y ARE svg pixels here
const at = (target: Element, type: string, x: number, y: number): void => {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(e, "pointerType", { value: "mouse" }); // jsdom 26 has no PointerEvent; Plot's pointer reads it
  target.dispatchEvent(e);
};
const hovered = (store: { getState(): { hover: ReadonlySet<string> } }): string[] => [
  ...store.getState().hover,
];
const lit = (root: Element): (string | null)[] =>
  Array.from(root.querySelectorAll(".sdv-hl")).map((e) => e.getAttribute("data-sdv-id"));

/**
 * Brooklyn's 2000 shots drawn the d3 way (blazing-the-nets main's hex chart is d3), one circle per shot stamped with
 * its row index, `k` px per tenth of a foot from the hoop: x_legacy -250..250, y_legacy -50..420 (all 2000 inside).
 */
const pos = (s: BknShot, k: number): [number, number] => [k * (s.x_legacy + 250), k * (420 - s.y_legacy)];
const points = (k = 1): HoverPoint[] =>
  BKN.map((s, i) => {
    const [x, y] = pos(s, k);
    return { x, y, id: toId(i) };
  });
const shotChart = (k = 1): SVGSVGElement => {
  const svg = create("svg").attr("viewBox", `0 0 ${500 * k} ${470 * k}`);
  svg
    .selectAll("circle")
    .data(BKN)
    .join("circle")
    .attr("data-sdv-id", (_, i) => toId(i)) // A6: a d3 chart joins by stamping its own ids
    .attr("cx", (s) => pos(s, k)[0])
    .attr("cy", (s) => pos(s, k)[1])
    .attr("r", 2);
  return svg.node() as SVGSVGElement;
};
// Shot 825: a missed 35 ft three, the sparsest mark: its nearest other shot is 59.1 px away at 1 px per tenth of a foot
const P = 825;
const [PX, PY] = pos(BKN[P] as BknShot, 1);
const label = (id: string): { lines: string[] } => {
  const s = BKN[Number(id)] as BknShot;
  return { lines: [`${s.shot_distance} ft, ${s.shot_value}PT`, s.shot_result] };
};
const corner = (svg: Element): [number, number] => {
  const m = /^translate\(([-\d.e]+),([-\d.e]+)\)$/.exec(
    svg.querySelector("g.sdv-tip")?.getAttribute("transform") ?? "",
  );
  return [Number(m?.[1]), Number(m?.[2])];
};

test("the fixture: shot 825 is 59.1 px from every other shot, so a pointer up to 19 px away is nearest to it", () => {
  const ps = points();
  const near = Math.min(...ps.filter((_, i) => i !== P).map((q) => Math.hypot(q.x - PX, q.y - PY)));
  expect(near).toBeCloseTo(59.1, 1);
  expect([BKN[P]?.shot_distance, BKN[P]?.shot_value, BKN[P]?.shot_result]).toEqual([35, 3, "Missed"]);
  expect([PX, PY]).toEqual([468, 145]);
});
test("2-D within 18 px (Review Focus 9): 10 px away hovers the shot and shows its tooltip AT THE POINT; 19 px away clears hover and hides it", () => {
  const svg = shotChart();
  const store = createSelection<BknShot>();
  nearestHover(svg, store, { points: points(), radius: 18, label });
  at(svg, "pointermove", PX + 10, PY);
  expect(hovered(store)).toEqual(["825"]);
  const tip = svg.querySelector("g.sdv-tip");
  expect(tip?.hasAttribute("display")).toBe(false);
  expect(Array.from(tip?.querySelectorAll("tspan") ?? []).map((t) => t.textContent)).toEqual([
    "35 ft, 3PT",
    "Missed",
  ]);
  // at the shot (468, 145), not at the pointer (478, 145): no room on its right in a 500 px svg, so it flips left
  const w = Number(tip?.querySelector("rect")?.getAttribute("width"));
  const h = Number(tip?.querySelector("rect")?.getAttribute("height"));
  expect(corner(svg)).toEqual([PX - 12 - w, PY - h - 8]);
  at(svg, "pointermove", PX, PY + 18); // exactly 18 px: still inside the radius (main clears only beyond it)
  expect(hovered(store)).toEqual(["825"]);
  at(svg, "pointermove", PX + 19, PY);
  expect(hovered(store)).toEqual([]);
  expect(tip?.getAttribute("display")).toBe("none");
});
test("one store update per distinct shot; pointerleave and pointercancel each clear once and hide the tooltip", () => {
  const svg = shotChart();
  const store = createSelection<BknShot>();
  const fn = vi.fn();
  store.subscribe(fn);
  nearestHover(svg, store, { points: points(), radius: 18, label });
  at(svg, "pointermove", PX + 10, PY);
  const mo = new MutationObserver(() => {});
  mo.observe(svg, { attributes: true, childList: true, subtree: true, characterData: true });
  at(svg, "pointermove", PX + 5, PY - 3); // the same shot: silent, in the store and in the DOM (no tooltip redraw)
  expect(fn).toHaveBeenCalledTimes(1);
  expect(mo.takeRecords()).toEqual([]);
  mo.disconnect();
  at(svg, "pointerleave", PX + 5, PY - 3);
  expect(hovered(store)).toEqual([]);
  expect(svg.querySelector("g.sdv-tip")?.getAttribute("display")).toBe("none");
  at(svg, "pointerleave", PX + 5, PY - 3);
  expect(fn).toHaveBeenCalledTimes(2);
  at(svg, "pointermove", PX - 10, PY);
  at(svg, "pointercancel", PX - 10, PY);
  expect(hovered(store)).toEqual([]);
  expect(fn).toHaveBeenCalledTimes(4);
});
test("1-D along x ignores y: master's voronoiDimension 'x' over the 36 distance-bin centres", () => {
  const bins = fgPctByDistance(BKN, 1, 35);
  expect(bins).toHaveLength(36);
  // master's share bars: linear x over [0, 36] feet, bar d spans [d, d + 1], hovered from its centre d + 0.5
  const x = scaleLinear([0, 36], [20, 620]);
  const y = scaleLinear([0, Math.max(...bins.map((b) => b.share))], [180, 20]);
  const svg = create("svg").attr("viewBox", "0 0 640 200").node() as SVGSVGElement;
  const ps = bins.map((b) => ({ x: x(b.distance + 0.5), y: y(b.share), id: toId(b.distance) }));
  const half = (x(1) - x(0)) / 2;
  const alongX = createSelection();
  const both = createSelection();
  nearestHover(svg, alongX, { points: ps, dimension: "x", radius: half });
  nearestHover(svg, both, { points: ps, dimension: "xy", radius: half });
  at(svg, "pointermove", x(12.3), 195); // 12.3 ft, at the very bottom: far below the 12 ft bar's top
  expect(hovered(alongX)).toEqual(["12"]);
  expect(hovered(both)).toEqual([]); // Euclidean: the bar top is out of reach
  at(svg, "pointermove", x(30.9), 25);
  expect(hovered(alongX)).toEqual(["30"]);
  // and "y" ignores x: master's side charts run distance down the y axis
  const side = create("svg").attr("viewBox", "0 0 300 400").node() as SVGSVGElement;
  const yd = scaleLinear([0, 36], [20, 380]);
  const alongY = createSelection();
  nearestHover(side, alongY, {
    points: bins.map((b) => ({ x: 20 + 200 * b.share, y: yd(b.distance + 0.5), id: toId(b.distance) })),
    dimension: "y",
    radius: (yd(1) - yd(0)) / 2,
  });
  at(side, "pointermove", 295, yd(20.4)); // far right of every bar
  expect(hovered(alongY)).toEqual(["20"]);
});
test("a pointer inside the 5 px padding margin clears (master's voronoiPadding: 5)", () => {
  const bins = fgPctByDistance(BKN, 1, 35);
  const x = scaleLinear([0, 36], [0, 640]); // bar 0 starts at the left edge
  const svg = create("svg").attr("viewBox", "0 0 640 200").node() as SVGSVGElement;
  const ps = bins.map((b) => ({ x: x(b.distance + 0.5), y: 100, id: toId(b.distance) }));
  const store = createSelection();
  nearestHover(svg, store, { points: ps, dimension: "x", padding: 5 }); // no radius: master's bars have none
  at(svg, "pointermove", 6, 100);
  expect(hovered(store)).toEqual(["0"]);
  at(svg, "pointermove", 4, 100); // inside the left margin
  expect(hovered(store)).toEqual([]);
  at(svg, "pointermove", 325, 196); // inside the bottom margin
  expect(hovered(store)).toEqual([]);
  at(svg, "pointermove", 325, 195); // on the margin's edge: in bounds
  expect(hovered(store)).toEqual(["18"]);
  at(svg, "pointermove", 637, 100); // inside the right margin
  expect(hovered(store)).toEqual([]);
  const unpadded = createSelection();
  nearestHover(svg, unpadded, { points: ps, dimension: "x" });
  at(svg, "pointermove", 4, 100);
  expect(hovered(unpadded)).toEqual(["0"]); // the default padding is 0
});
test("update(points) after a rescale re-targets", () => {
  const svg = shotChart();
  const store = createSelection<BknShot>();
  const hover = nearestHover(svg, store, { points: points(), radius: 18, label });
  const [hx, hy] = [PX / 2, PY / 2]; // where shot 825 is drawn at half the scale
  at(svg, "pointermove", hx + 5, hy);
  expect(hovered(store)).not.toEqual(["825"]);
  at(svg, "pointermove", PX + 10, PY);
  expect(hovered(store)).toEqual(["825"]);
  const w = Number(svg.querySelector("g.sdv-tip rect")?.getAttribute("width"));
  expect(corner(svg)[0]).toBe(PX - 12 - w);
  svg.setAttribute("viewBox", "0 0 250 235"); // the chart is redrawn at 0.5 px per tenth of a foot
  hover.update(points(0.5));
  at(svg, "pointermove", hx + 5, hy);
  expect(hovered(store)).toEqual(["825"]);
  expect(corner(svg)[0]).toBe(hx - 12 - w); // the same shot, so the same id: the tooltip still moves to it
  hover.update([]); // empty points always clear
  at(svg, "pointermove", hx, hy);
  expect(hovered(store)).toEqual([]);
});
test("with linkSelection(store, { figure, hover: false }), a mouseover on a mark writes nothing and nearestHover alone sets hover; highlight still follows", () => {
  const svg = shotChart();
  const store = createSelection<BknShot>();
  linkSelection(store, { figure: svg, hover: false });
  nearestHover(svg, store, { points: points(), radius: 18 });
  const fn = vi.fn();
  store.subscribe(fn);
  svg.querySelector('[data-sdv-id="0"]')?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  expect(fn).not.toHaveBeenCalled();
  at(svg, "pointermove", PX + 10, PY);
  expect(hovered(store)).toEqual(["825"]);
  expect(lit(svg)).toEqual(["825"]);
  expect(svg.classList.contains("sdv-focus")).toBe(true); // the other 1999 shots dim
  at(svg, "pointerleave", PX + 10, PY);
  expect(lit(svg)).toEqual([]);
  expect(svg.classList.contains("sdv-focus")).toBe(false);
});
test("on a Plot figure with tip: true, a pointerdown still reaches nearestHover (A34: Plot's handler stops other listeners)", () => {
  const svg = Plot.plot({
    width: 640,
    height: 400,
    x: { domain: [0, 17] },
    y: { domain: [-0.2, 0.2] },
    marks: [
      Plot.dot(STANDINGS, { x: "wins", y: "net_epa", r: 6, tip: true, render: linkIds(STANDINGS, "team") }),
    ],
  });
  const sx = svg.scale("x");
  const sy = svg.scale("y");
  const xy = (d: Standing): [number, number] => [Number(sx?.apply(d.wins)), Number(sy?.apply(d.net_epa))];
  const ps = STANDINGS.filter((d) => d.net_epa !== null).map((d) => ({
    x: xy(d)[0],
    y: xy(d)[1],
    id: d.team,
  }));
  const store = createSelection<Standing>();
  nearestHover(svg, store, { points: ps, radius: 18 });
  const [kx, ky] = xy(STANDINGS[0] as Standing);
  const [bx, by] = xy(STANDINGS[4] as Standing);
  at(svg, "pointermove", kx + 4, ky); // Plot's tip now points at KC: its pointerdown will pin it and stop the event
  expect(hovered(store)).toEqual(["KC"]);
  at(svg, "pointerdown", bx + 4, by); // a tap on BUF
  expect(hovered(store)).toEqual(["BUF"]);
});
test("destroy removes the listeners and the tooltip, and clears the hover it set", () => {
  const svg = shotChart();
  const store = createSelection<BknShot>();
  const hover = nearestHover(svg, store, { points: points(), radius: 18, label });
  at(svg, "pointermove", PX + 10, PY);
  hover.destroy();
  expect(hovered(store)).toEqual([]);
  expect(svg.querySelector("g.sdv-tip")).toBeNull();
  at(svg, "pointermove", PX + 10, PY);
  expect(hovered(store)).toEqual([]);
  // a hover another writer set since is not this handle's to clear
  const again = nearestHover(svg, store, { points: points(), radius: 18 });
  at(svg, "pointermove", PX + 10, PY);
  store.set({ hover: ["0"] });
  again.destroy();
  expect(hovered(store)).toEqual(["0"]);
});
test("destroy right after update(points) still clears the hover this handle wrote: a rescale keeps its ownership", () => {
  const svg = shotChart();
  const store = createSelection<BknShot>();
  const hover = nearestHover(svg, store, { points: points(), radius: 18, label });
  at(svg, "pointermove", PX + 10, PY);
  expect(hovered(store)).toEqual(["825"]);
  svg.setAttribute("viewBox", "0 0 250 235"); // the chart is rescaled, then torn down before the pointer moves again
  hover.update(points(0.5));
  hover.destroy();
  expect(hovered(store)).toEqual([]);
  // and an update still leaves another writer's hover alone
  const again = nearestHover(svg, store, { points: points(), radius: 18 });
  at(svg, "pointermove", PX + 10, PY);
  store.set({ hover: ["0"] });
  again.update(points());
  again.destroy();
  expect(hovered(store)).toEqual(["0"]);
});
test("an equal hover the app set first stays the app's: hovering that shot claims nothing, so destroy keeps it", () => {
  const svg = shotChart();
  const store = createSelection<BknShot>();
  store.set({ hover: ["825"] }); // the app preloads shot 825
  const hover = nearestHover(svg, store, { points: points(), radius: 18 });
  const fn = vi.fn();
  store.subscribe(fn);
  at(svg, "pointermove", PX + 10, PY); // nearest is 825: a no-op patch
  hover.destroy();
  expect([hovered(store), fn.mock.calls.length]).toEqual([["825"], 0]);
  const again = nearestHover(svg, store, { points: points(), radius: 18 }); // a shot it does write is its own
  at(svg, "pointermove", PX + 60, PY + 60);
  at(svg, "pointermove", PX + 10, PY);
  again.destroy();
  expect(hovered(store)).toEqual([]);
});
test("the pointer still over a shot re-writes it once another view hovered something else; off every shot, it writes nothing", () => {
  const svg = shotChart();
  const store = createSelection<BknShot>();
  nearestHover(svg, store, { points: points(), radius: 18 });
  at(svg, "pointermove", PX + 10, PY);
  store.set({ hover: ["0"] }); // another writer (a linked table row) hovers shot 0 while the pointer rests here
  const fn = vi.fn();
  store.subscribe(fn);
  at(svg, "pointermove", PX + 9, PY); // the pointer moves on, still nearest shot 825: the latest event wins
  expect([hovered(store), fn.mock.calls.length]).toEqual([["825"], 1]);
  at(svg, "pointermove", PX + 8, PY); // and stays: no churn
  expect(fn).toHaveBeenCalledTimes(1);
  at(svg, "pointermove", PX + 40, PY + 40); // past 18 px: clears its own hover
  store.set({ hover: ["0"] });
  at(svg, "pointermove", PX + 41, PY + 41); // still near nothing: another writer's hover is not cleared again
  expect([hovered(store), fn.mock.calls.length]).toEqual([["0"], 3]);
});
test("argument errors throw InputError: a negative radius or padding, an unknown dimension, a root that is not an <svg>", () => {
  const store = createSelection();
  const svg = shotChart();
  expect(() => nearestHover(svg, store, { points: [], radius: -1 })).toThrow(/radius/);
  expect(() => nearestHover(svg, store, { points: [], padding: Number.NaN })).toThrow(/padding/);
  expect(() => nearestHover(svg, store, { points: [], dimension: "z" as "x" })).toThrow(/dimension/);
  expect(() => nearestHover(document.createElement("div"), store, { points: [] })).toThrow(/<svg>/);
});
