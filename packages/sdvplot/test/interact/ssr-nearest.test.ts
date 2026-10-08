// @vitest-environment node
import { select } from "d3";
import { JSDOM } from "jsdom";
import { expect, test } from "vitest";
import { InputError } from "../../src/errors.js";
import { linkSelection, nearestHover, tooltip } from "../../src/interact/index.js";
import { createSelection, toId } from "../../src/selection.js";
import { BKN, type BknShot } from "../shots/fixture.js";

// Brooklyn's 2000 shots as a server would render them with d3: a jsdom document, but no window global
const chart = (): SVGSVGElement => {
  const doc = new JSDOM("").window.document;
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 500 470");
  select(svg)
    .selectAll("circle")
    .data(BKN)
    .join("circle")
    .attr("data-sdv-id", (_, i) => toId(i))
    .attr("cx", (s) => s.x_legacy + 250)
    .attr("cy", (s) => 420 - s.y_legacy)
    .attr("r", 2);
  return svg as unknown as SVGSVGElement;
};
const points = BKN.map((s, i) => ({ x: s.x_legacy + 250, y: 420 - s.y_legacy, id: toId(i) }));
/** A root whose every read throws: a guard placed after the first property access fails here. */
const untouchable = new Proxy({} as Element, {
  get(_, key) {
    throw new Error(`read root.${String(key)} without a DOM`);
  },
});

test("no DOM: nearestHover and tooltip return no-op handles and touch neither the root nor the store", () => {
  expect(typeof window).toBe("undefined");
  const store = createSelection<BknShot>();
  const before = store.getState();
  const hover = nearestHover(untouchable, store, { points, radius: 18, label: () => ({ lines: ["35 ft"] }) });
  hover.update(points);
  hover.destroy();
  const tip = tooltip(untouchable);
  tip.show(468, 145, ["35 ft, 3PT", "Missed"], "#000000");
  tip.hide();
  tip.destroy();
  expect(store.getState()).toBe(before);
});
test("SSR (Review Focus 12): a d3 chart is byte-identical with nearestHover, a shown tooltip and an ACTIVE store", () => {
  const before = chart().outerHTML;
  const svg = chart();
  const store = createSelection<BknShot>();
  store.set({ hover: ["825"], selected: ["0", "1"] });
  const off = linkSelection(store, { figure: svg, hover: false });
  const hover = nearestHover(svg, store, { points, radius: 18, label: () => ({ lines: ["35 ft, 3PT"] }) });
  tooltip(svg).show(468, 145, ["35 ft, 3PT", "Missed"]); // a tooltip renders nothing server-side
  hover.update(points);
  hover.destroy();
  off();
  expect(svg.outerHTML).toBe(before);
  expect(before).not.toContain("sdv-tip");
  expect([...store.getState().hover]).toEqual(["825"]); // the inert handle never wrote to the store
});
test("argument errors still throw in Node: a negative radius or padding, a non-positive fontSize", () => {
  const store = createSelection();
  expect(() => nearestHover(untouchable, store, { points, radius: -1 })).toThrow(InputError);
  expect(() => nearestHover(untouchable, store, { points, padding: -5 })).toThrow(InputError);
  expect(() => tooltip(untouchable, { fontSize: -11 })).toThrow(InputError);
});
