// @vitest-environment jsdom
import { scaleLinear, select } from "d3";
import { expect, test } from "vitest";
import { appendSurface } from "../src/d3.js";
import { basketballCourt, footballField, hockeyRink } from "../src/index.js";
import {
  type PolygonFeature,
  type Scene,
  type TextFeature,
  isVisiblePolygon,
  isVisibleText,
} from "../src/scene.js";

function draw(scene: Scene) {
  const [x0, y0, x1, y1] = scene.bbox;
  const x = scaleLinear().domain([x0, x1]).range([0, 1000]);
  const y = scaleLinear().domain([y0, y1]).range([425, 0]);
  const svg = select(document.body).append("svg");
  return { g: appendSurface(svg, scene, x, y), x, y };
}

test("appendSurface draws one path per visible polygon in zIndex order through the scales", () => {
  const rink = hockeyRink("nhl");
  const { g } = draw(rink);
  const polys = rink.features
    .filter((f): f is PolygonFeature => f.kind === "polygon" && isVisiblePolygon(f))
    .sort((a, b) => a.zIndex - b.zIndex);
  const paths = g.selectAll<SVGPathElement, unknown>("path").nodes();
  expect(paths).toHaveLength(polys.length);
  expect(paths.map((p) => p.getAttribute("data-feature"))).toEqual(polys.map((f) => f.name));
  expect(paths[0]!.getAttribute("d")).toMatch(/Z$/);
  expect(g.attr("class")).toBe("sporty-surface");
  expect(g.node()!.outerHTML).not.toMatch(/NaN/);
});

test("hidden fill with a stroke is drawn with fill none; stroke only when defined", () => {
  const base = { kind: "polygon", name: "p", zIndex: 0 } as const;
  const sq = [
    [0, 0],
    [1, 0],
    [1, 1],
  ] as const;
  const { background: _bg, ...rink } = hockeyRink("nhl");
  const scene: Scene = {
    ...rink,
    features: [
      { ...base, fill: "#ff000000", points: sq },
      { ...base, name: "s", fill: "#ff000000", stroke: "#000000", points: sq },
      { ...base, name: "f", fill: "#ff0000", points: sq },
      { ...base, name: "bad", fill: "#ff0000", points: [[0, Number.NaN]] },
    ],
  };
  const { g } = draw(scene);
  const paths = g.selectAll<SVGPathElement, unknown>("path").nodes();
  expect(paths.map((p) => p.getAttribute("data-feature"))).toEqual(["s", "f"]);
  expect(paths[0]!.getAttribute("fill")).toBe("none");
  expect(paths[0]!.getAttribute("stroke")).toBe("#000000");
  expect(paths[1]!.hasAttribute("stroke")).toBe(false);
});

test("background rect is appended first when defined, absent otherwise", () => {
  const bg = basketballCourt("nba", { colorUpdates: { plot_background: "#123456" } });
  const first = draw(bg).g.node()!.firstElementChild!;
  expect(first.tagName).toBe("rect");
  expect(first.getAttribute("fill")).toBe("#123456");
  expect(first.getAttribute("data-feature")).toBe("background");
  const none = draw(basketballCourt("nba")).g.node()!;
  expect(none.querySelector("[data-feature=background]")).toBeNull();
});

test("text: visible count, font size through y, negated rotation", () => {
  const field = footballField("nfl");
  const { g, y } = draw(field);
  const texts = field.features.filter((f): f is TextFeature => f.kind === "text" && isVisibleText(f));
  const els = g.selectAll<SVGTextElement, unknown>("text").nodes();
  expect(els).toHaveLength(texts.length);
  const sorted = [...texts].sort((a, b) => a.zIndex - b.zIndex);
  sorted.forEach((f, i) => {
    const el = els[i]!;
    expect(
      Math.abs(Number(el.getAttribute("font-size")) - Math.abs(y(f.fitBox[1] / 1.5) - y(0))),
    ).toBeLessThan(1e-6);
    expect(el.getAttribute("data-feature")).toBe(f.name);
  });
  const rotIdx = sorted.findIndex((f) => f.rotation !== 0);
  expect(rotIdx).toBeGreaterThanOrEqual(0);
  expect(els[rotIdx]!.getAttribute("transform")).toMatch(
    new RegExp(`^rotate\\(${-sorted[rotIdx]!.rotation} `),
  );
  expect(g.node()!.outerHTML).not.toMatch(/NaN/);
});
