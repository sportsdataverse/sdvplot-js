// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { scaleLinear, select } from "d3";
import { expect, test } from "vitest";
import { appendLegend, appendSignature } from "../../src/d3/index.js";
import { shootingSignature } from "../../src/plot/index.js";
import {
  diffScale,
  fgPctByDistance,
  signaturePoints,
  sizeCells,
  squarePath,
  vsLeague,
} from "../../src/shots/index.js";
import { BKN, LEAGUE } from "../shots/fixture.js";

const attr = (sel: Iterable<Element>, name: string) => [...sel].map((n) => n.getAttribute(name));
const texts = (root: Element) => [...root.querySelectorAll("text")].map((n) => n.textContent);
const newG = () => select(document.body).append("svg").append("g");

test("appendLegend: main's 5-stop bar, -15/0/+15 ticks, caption, and a 1 / 15 / 30+ hex size key", () => {
  const svg = select(document.body).append("svg");
  const s = sizeCells([{ attempts: 1 }, { attempts: 30 }, { attempts: 60 }], { radius: 15 });
  const used = appendLegend(svg.append("g"), diffScale(), {
    width: 476,
    size: { px: s.size, steps: [1, 15, 30] },
  });
  const root = svg.node() as SVGSVGElement;
  expect(attr(root.querySelectorAll("stop"), "stop-color")).toEqual(
    [-0.15, -0.075, 0, 0.075, 0.15].map((d) => diffScale()(d)),
  );
  expect(texts(root).slice(0, 3)).toEqual(["−15.0", "0", "+15.0"]);
  expect(texts(root)).toContain("30+");
  expect(texts(root)).toContain("hex size: attempts");
  expect(used).toBe(8 + 11 + 6 + 2 * 15 + 8 + 42); // bar + ticks, caption + key-in-words, size key
});

test("appendLegend size key, shape 'square' (J38): squares at the same pixel sizes, and a square note", () => {
  const svg = select(document.body).append("svg");
  const s = sizeCells([{ attempts: 1 }, { attempts: 30 }, { attempts: 60 }], { shape: "square", side: 15 });
  appendLegend(svg.append("g"), diffScale(), {
    width: 476,
    size: { px: s.size, steps: s.steps, shape: "square" },
  });
  const root = svg.node() as SVGSVGElement;
  expect(attr(root.querySelectorAll("path"), "d")).toEqual(s.steps.map((n) => squarePath(s.size(n))));
  expect(texts(root)).toContain("square size: attempts");
});

test("appendLegend domain: master's legend spans [-0.30, 0.30] (Legend.js:36-38), its colours exact at every stop", () => {
  const svg = select(document.body).append("svg");
  const master = diffScale({ palette: "master" }); // stops at ±0.99, ±0.15 and 0, linear between
  const ticks = [-0.3, -0.15, 0, 0.15, 0.3];
  appendLegend(svg.append("g"), master, { domain: [-0.3, 0.3], ticks, format: (d) => (100 * d).toFixed(0) });
  const root = svg.node() as SVGSVGElement;
  expect(attr(root.querySelectorAll("stop"), "offset")).toEqual(["0%", "25%", "50%", "75%", "100%"]);
  expect(attr(root.querySelectorAll("stop"), "stop-color")).toEqual(ticks.map((d) => master(d)));
  const tickText = [...root.querySelectorAll("text")].slice(0, 5);
  expect(tickText.map((n) => Number(n.getAttribute("x")))).toEqual([0, 60, 120, 180, 240]); // spread over the bar
  expect(tickText.map((n) => n.textContent)).toEqual(["-30", "-15", "0", "15", "30"]);
  expect(() => appendLegend(svg.append("g"), master, { domain: [0.3, 0.3] })).toThrow(/domain/);
});

test("appendSignature: league lines and the ribbon through the caller's pixel scales", () => {
  const pts = signaturePoints(vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot));
  const g = appendSignature(newG(), pts, {
    x: scaleLinear([0, 35], [40, 488]),
    y: scaleLinear([0, 1], [226, 36]),
  });
  expect(g.selectAll("path").size()).toBe(3);
  expect(g.select("linearGradient").attr("x1")).toBe("40");
  expect(g.selectAll("stop").size()).toBe(61);
});

test("appendSignature: content-hash gradient ids that follow the stops AND the pixel x range (two widths, two ids)", () => {
  const pts = signaturePoints(vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot));
  const y = scaleLinear([0, 1], [226, 36]);
  const id = (x1: number, fill = diffScale()) =>
    appendSignature(newG(), pts, { x: scaleLinear([0, 35], [x1, 488]), y, fill })
      .select("linearGradient")
      .attr("id");
  expect(id(40)).toMatch(/^sdv-signature-[0-9a-z]+$/);
  expect(id(40)).toBe(id(40));
  expect(id(40)).not.toBe(id(60)); // same stops, another width
  expect(id(40)).not.toBe(id(40, diffScale({ theme: "dark" }))); // same width, other stops
});

test("appendSignature draws Plot's shootingSignature: same ribbon, league lines, gradient id, x range and stops", () => {
  const pts = signaturePoints(vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot));
  // A 190 px [0, 1] y axis (main's PLOT_H): Plot's default half-width is d3's pixel default / 190 in y units.
  const fig = Plot.plot({
    width: 528,
    height: 230,
    marginTop: 20,
    marginBottom: 20,
    y: { domain: [0, 1] },
    marks: shootingSignature(pts),
  });
  const sx = fig.scale("x");
  const sy = fig.scale("y");
  if (sx === undefined || sy === undefined) throw new Error("no x/y scale");
  expect(Math.abs((sy.apply(0) as number) - (sy.apply(1) as number))).toBe(190);
  const g = appendSignature(newG(), pts, {
    x: (v) => sx.apply(v) as number,
    y: (v) => sy.apply(v) as number,
  });
  const d3Node = g.node() as SVGGElement;
  const plotPaths = [
    ...fig.querySelectorAll("g[aria-label=line] path"),
    ...fig.querySelectorAll("g[aria-label=area] path"),
  ];
  expect(attr(d3Node.querySelectorAll("path"), "d")).toEqual(attr(plotPaths, "d")); // faint line, strong line, ribbon
  const [pg, dg] = [fig.querySelector("linearGradient"), d3Node.querySelector("linearGradient")];
  for (const a of ["id", "gradientUnits", "x1", "x2"]) expect(dg?.getAttribute(a)).toBe(pg?.getAttribute(a));
  for (const a of ["offset", "stop-color"])
    expect(attr(dg?.querySelectorAll("stop") ?? [], a)).toEqual(attr(pg?.querySelectorAll("stop") ?? [], a));
  expect(dg?.querySelectorAll("stop")).toHaveLength(61);
});
