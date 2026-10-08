// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { expect, test, vi } from "vitest";
import { STANDINGS, type Standing } from "../../../sdvtables/test/fixtures/standings.js";
import { InputError } from "../../src/errors.js";
import { brushFilter } from "../../src/interact/index.js";
import { linkIds } from "../../src/plot/index.js";
import { createSelection, focusIds } from "../../src/selection.js";

// 2024 AFC: wins x net EPA/play. NE's net_epa is null, so NE has no dot.
const chart = (tip = false): ReturnType<typeof Plot.plot> =>
  Plot.plot({
    width: 640,
    height: 400,
    x: { domain: [0, 17] },
    y: { domain: [-0.2, 0.2] },
    marks: [Plot.dot(STANDINGS, { x: "wins", y: "net_epa", tip, render: linkIds(STANDINGS, "team") })],
  });
const setup = (tip = false) => {
  const svg = chart(tip);
  const store = createSelection<Standing>();
  const brush = brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" });
  return { svg, store, brush };
};
const passing = (s: ReturnType<typeof createSelection<Standing>>): string[] =>
  STANDINGS.filter((r) => s.getState().predicate?.(r)).map((r) => r.team);

/** A data point as the client coordinates of a mouse event (jsdom has no layout: d3 and Plot read them as svg px). */
const px = (svg: ReturnType<typeof Plot.plot>, x: number, y: number): MouseEventInit => ({
  bubbles: true,
  cancelable: true,
  clientX: Number(svg.scale("x")?.apply(x)),
  clientY: Number(svg.scale("y")?.apply(y)),
});
/**
 * A mouse event whose `view` is the window (d3-brush listens for the drag there; vitest's global `window` is not
 * jsdom's `Window` instance, so the init dictionary rejects it). jsdom 26 has no PointerEvent, and Plot's pointer
 * reads `pointerType`: a `pointer*` event gets "mouse".
 */
const mouse = (type: string, init: MouseEventInit): MouseEvent => {
  const e = new MouseEvent(type, init);
  Object.defineProperty(e, "view", { value: window });
  if (type.startsWith("pointer")) Object.defineProperty(e, "pointerType", { value: "mouse" });
  return e;
};
// jsdom has no layout: Plot's tip measures its text with getBBox a frame after it draws (tip.js postrender)
Object.defineProperty(SVGElement.prototype, "getBBox", {
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
});
const tipText = (svg: Element): string =>
  Array.from(svg.querySelectorAll('g[aria-label="tip"] text'))
    .map((t) => t.textContent)
    .join(" ");

test("a brushed region selects the ids inside and sets the same region as a row predicate, in ONE update", () => {
  const { store, brush } = setup();
  const fn = vi.fn();
  store.subscribe(fn);
  brush.move({ x: [9.5, 16], y: [0, 0.2] });
  expect(fn).toHaveBeenCalledTimes(1);
  expect([...store.getState().selected]).toEqual(["KC", "LAC", "DEN", "BUF"]);
  expect(passing(store)).toEqual(["KC", "LAC", "DEN", "BUF"]);
  brush.move({ x: [9.5, 16], y: [0.07, 0.2] }); // raise the floor past KC's 0.063: y bounds the region too
  expect(fn).toHaveBeenCalledTimes(2);
  expect([...store.getState().selected]).toEqual(["LAC", "DEN", "BUF"]);
  expect(passing(store)).toEqual(["LAC", "DEN", "BUF"]);
});
test("a brush over no point: predicate set, selected EMPTY, focus dims everything; clearing resets both (Review Focus 2)", () => {
  const { store, brush } = setup();
  brush.move({ x: [0.5, 2], y: [0.15, 0.19] }); // no 2024 AFC team won fewer than 4
  expect(store.getState().selected.size).toBe(0);
  expect(passing(store)).toEqual([]);
  expect(focusIds(store.getState())).toEqual(new Set());
  brush.move(null);
  expect(store.getState().predicate).toBeNull();
  expect(focusIds(store.getState())).toBeNull();
});
test("a null coordinate is never inside, even when the brushed range spans 0 (Number(null) is 0)", () => {
  const { store, brush } = setup();
  brush.move({ x: [0.5, 16.5], y: [-0.199, 0.199] });
  expect(store.getState().selected.size).toBe(7);
  expect(store.getState().selected.has("NE")).toBe(false);
  expect(passing(store)).not.toContain("NE");
});
test("without `id`, a row's link id is its index into `data`, as `linkIds` stamps by default", () => {
  const svg = chart();
  const store = createSelection<Standing>();
  brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa" }).move({ x: [9.5, 16], y: [0, 0.2] });
  expect([...store.getState().selected]).toEqual(["0", "1", "2", "4"]); // KC, LAC, DEN, BUF
});
test("the overlay sits behind the marks; destroy removes it and clears only what this brush set", () => {
  const { svg, store, brush } = setup();
  expect(svg.firstElementChild?.getAttribute("class")).toBe("sdv-brush");
  brush.move({ x: [9.5, 16], y: [0, 0.2] });
  brush.destroy();
  expect(svg.querySelector(".sdv-brush")).toBeNull();
  expect(store.getState().predicate).toBeNull();
  const other = (r: Standing): boolean => r.conf === "AFC";
  const again = setup();
  again.store.set({ predicate: other });
  again.brush.destroy();
  expect(again.store.getState().predicate).toBe(other);
});
test("a ScaleLike with no range (it is optional) brushes across the svg's box on that axis, never [Infinity, -Infinity]", () => {
  const svg = chart();
  const x = svg.scale("x") as Plot.Scale;
  const store = createSelection<Standing>();
  // an adapter that maps and inverts but carries no pixel range: the x extent falls back to the svg's width
  const scales = { x: { apply: (v: unknown) => x.apply(v), invert: (p: unknown) => x.invert?.(p) } };
  const brush = brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team", scales });
  const overlay = svg.querySelector(".sdv-brush .overlay");
  const [y0, y1] = Array.from(svg.scale("y")?.range ?? [], Number).sort((a, b) => a - b);
  expect(["x", "width", "y", "height"].map((a) => Number(overlay?.getAttribute(a)))).toEqual([
    0,
    640,
    y0,
    (y1 ?? 0) - (y0 ?? 0),
  ]);
  brush.move({ x: [9.5, 16], y: [0, 0.2] });
  expect([...store.getState().selected]).toEqual(["KC", "LAC", "DEN", "BUF"]);
});
test("a band x scale throws InputError at construction", () => {
  const bars = Plot.plot({ marks: [Plot.barY(STANDINGS, { x: "team", y: "wins" })] });
  expect(() =>
    brushFilter(bars, createSelection<Standing>(), { data: STANDINGS, x: "team", y: "wins" }),
  ).toThrow(InputError);
});
test("brushFilter on a figure with tip: the brush still writes the store (A22); the press pins the tip showing then", () => {
  const { svg, store } = setup(true);
  const fn = vi.fn();
  store.subscribe(fn);
  const from = px(svg, 15.5, 0.05); // ~21 px from KC's dot, on the overlay: the tip points at KC
  const to = px(svg, 9.5, 0.2);
  svg.dispatchEvent(mouse("pointermove", from));
  expect(tipText(svg)).toContain("0.063"); // KC's net EPA
  // A mouse press: pointerdown first (Plot pins its tip and stops other pointerdown listeners), then mousedown,
  // which d3-brush listens for on its overlay. Then a drag and a release, which d3 listens for on the window.
  const overlay = svg.querySelector(".sdv-brush .overlay");
  overlay?.dispatchEvent(mouse("pointerdown", from));
  overlay?.dispatchEvent(mouse("mousedown", from));
  window.dispatchEvent(mouse("mousemove", to));
  window.dispatchEvent(mouse("mouseup", to));
  expect([...store.getState().selected]).toEqual(["KC", "LAC", "DEN", "BUF"]);
  expect(passing(store)).toEqual(["KC", "LAC", "DEN", "BUF"]);
  expect(fn).toHaveBeenCalledTimes(1); // the release ends the same region: no second update
  svg.dispatchEvent(mouse("pointermove", px(svg, 13, 0.19))); // onto BUF's dot
  expect(tipText(svg)).toContain("0.063"); // still KC: the press pinned the tip (README)
});
