// @vitest-environment jsdom
import { create } from "d3";
import { beforeAll, expect, test } from "vitest";
import { STANDINGS } from "../../../sdvtables/test/fixtures/standings.js";
import { loadLeague, teamColorsSync } from "../../src/index.js";
import { tooltip } from "../../src/interact/index.js";

beforeAll(() => loadLeague("nfl"));

// Kansas City's 2024 line (STANDINGS row 0) as a chart would show it on hover
const KC = STANDINGS[0];
const LINES = [`${KC?.team} ${KC?.wins}-${KC?.losses}`, `Net EPA/play ${KC?.net_epa}`, `QB ${KC?.qb}`];
const svgOf = (w = 640, h = 400): SVGSVGElement =>
  create("svg").attr("viewBox", `0 0 ${w} ${h}`).node() as SVGSVGElement;
const tipOf = (svg: Element): Element => svg.querySelector("g.sdv-tip") as Element;
const num = (el: Element | null, a: string): number => Number(el?.getAttribute(a));
/** The tooltip's top-left corner, from its translate. */
const corner = (svg: Element): [number, number] => {
  const m = /^translate\(([-\d.e]+),([-\d.e]+)\)$/.exec(tipOf(svg).getAttribute("transform") ?? "");
  return [Number(m?.[1]), Number(m?.[2])];
};
// The size is estimated from the text, never measured (jsdom and SSR have no getBBox): font 11 by default
const W = (lines: readonly string[], swatch: boolean, fs = 11): number =>
  Math.ceil(16 + 0.6 * fs * Math.max(...lines.map((l) => l.length)) + (swatch ? 20 : 0));
const H = (lines: readonly string[], fs = 11): number => Math.ceil(10 + 1.35 * fs * lines.length);

test("lines and swatch render, the first line bold; it is re-appended last, above the marks drawn after it", () => {
  const svg = svgOf();
  const tip = tooltip(svg);
  const g = tipOf(svg);
  expect(g.getAttribute("pointer-events")).toBe("none");
  expect(g.getAttribute("display")).toBe("none"); // drawn hidden
  svg.append(create("svg:circle").node() as SVGCircleElement); // a mark drawn after the tooltip
  const red = teamColorsSync("nfl", "KC") as string;
  expect(red).toMatch(/^#[0-9a-f]{6}$/i);
  tip.show(100, 200, LINES, red);
  expect(g.hasAttribute("display")).toBe(false);
  expect(svg.lastElementChild).toBe(g);
  const spans = Array.from(g.querySelectorAll("text > tspan"));
  expect(spans.map((t) => t.textContent)).toEqual(["KC 15-2", "Net EPA/play 0.063", "QB Patrick Mahomes"]);
  expect(spans.map((t) => t.getAttribute("font-weight"))).toEqual(["bold", null, null]);
  const box = g.querySelector("rect.sdv-tip-box");
  expect(box?.getAttribute("rx")).toBe("4");
  expect([num(box, "width"), num(box, "height")]).toEqual([W(LINES, true), H(LINES)]);
  const sw = g.querySelector("rect.sdv-tip-swatch");
  expect(sw?.getAttribute("fill")).toBe(red);
  expect([num(sw, "width"), num(sw, "height"), num(sw, "x")]).toEqual([12, 12, W(LINES, true) - 20]); // at the right
  // without a swatch: no swatch rect and no room kept for one
  tip.show(100, 200, LINES.slice(0, 2));
  expect(g.querySelector("rect.sdv-tip-swatch")).toBeNull();
  expect(num(box, "width")).toBe(W(LINES.slice(0, 2), false));
  expect(g.querySelectorAll("tspan")).toHaveLength(2);
  // colours are CSS custom properties with fallbacks, in ONE style element per root however many tooltips it holds
  tooltip(svg);
  const styles = svg.querySelectorAll('style[data-sdv-interact="tip"]');
  expect(styles).toHaveLength(1);
  expect(styles[0]?.textContent).toContain("var(--sdv-tip-bg,rgba(34,34,34,.85))");
  expect(styles[0]?.textContent).toContain("var(--sdv-tip-fg,#ddd)");
});
test("placed 12 px right of the point and above it; flips left past the right edge and stays inside the bottom", () => {
  const svg = svgOf();
  const tip = tooltip(svg);
  const [w, h] = [W(LINES, false), H(LINES)];
  tip.show(100, 200, LINES);
  expect(corner(svg)).toEqual([112, 200 - h - 8]);
  tip.show(630, 395, LINES); // no room on the right: flipped to the left of the point
  expect(corner(svg)).toEqual([630 - 12 - w, 395 - h - 8]);
  tip.show(630, 430, LINES); // a point below the bottom edge (a label under the axis): the box stays inside
  expect(corner(svg)).toEqual([630 - 12 - w, 400 - h]);
  tip.show(100, 5, LINES); // too high: clamped to the top
  expect(corner(svg)).toEqual([112, 0]);
});
test("width and height override the viewBox; fontSize scales the estimate", () => {
  const svg = svgOf();
  const tip = tooltip(svg, { width: 300, height: 120, fontSize: 14 });
  tip.show(250, 110, LINES);
  const [w, h] = [W(LINES, false, 14), H(LINES, 14)];
  expect(num(tipOf(svg).querySelector("rect.sdv-tip-box"), "width")).toBe(w);
  expect(corner(svg)).toEqual([250 - 12 - w, 110 - h - 8]); // past width 300, though the viewBox is 640 wide
  tip.show(100, 200, LINES); // below height 120, though the viewBox is 400 high
  expect(corner(svg)).toEqual([112, 120 - h]);
  expect(tipOf(svg).querySelector("text")?.getAttribute("font-size")).toBe("14");
});
test("a viewBox that does not start at 0 keeps the box inside it", () => {
  const svg = create("svg").attr("viewBox", "-250 -52.5 500 470").node() as SVGSVGElement; // a court, hoop at 0,0
  const tip = tooltip(svg);
  const [w, h] = [W(LINES, false), H(LINES)];
  tip.show(240, -40, LINES); // near the top right corner
  expect(corner(svg)).toEqual([240 - 12 - w, -52.5]);
  tip.show(-245, 400, LINES); // near the bottom left corner
  expect(corner(svg)).toEqual([-245 + 12, 400 - h - 8]);
});
test("hide() hides, destroy() removes", () => {
  const svg = svgOf();
  const tip = tooltip(svg);
  tip.show(100, 200, LINES);
  tip.hide();
  expect(tipOf(svg).getAttribute("display")).toBe("none");
  tip.destroy();
  expect(svg.querySelector("g.sdv-tip")).toBeNull();
});
test("argument errors throw InputError: a non-positive fontSize, a negative size, a root that is not an <svg>", () => {
  expect(() => tooltip(svgOf(), { fontSize: 0 })).toThrow(/fontSize/);
  expect(() => tooltip(svgOf(), { width: -1 })).toThrow(/width/);
  expect(() => tooltip(document.createElement("div"))).toThrow(/<svg>/);
});
