// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { beforeAll, expect, test } from "vitest";
import { InputError, loadLeague, logoUrlSync, setWarningHandler } from "../../src/index.js";
import { titleImage } from "../../src/plot/index.js";

beforeAll(() => loadLeague("nfl"));
const dot = () => Plot.dot([{ x: 1, y: 1 }], { x: "x", y: "y" });
test("titleImage puts the team logo before the <h2> text at the pixel height asked", () => {
  const fig = Plot.plot({ title: "Chiefs", marks: [dot()] }) as HTMLElement;
  const out = titleImage(fig, { image: "KC", league: "nfl", height: 20 });
  const img = out.querySelector("h2 img") as Element;
  expect(img.getAttribute("src")).toBe(logoUrlSync("KC", "nfl"));
  expect(img.getAttribute("height")).toBe("20");
  expect((out.querySelector("h2") as Element).firstElementChild).toBe(img);
  expect((out.querySelector("h2") as Element).textContent).toContain("Chiefs");
});
test("a bare svg is wrapped in a figure with the given title; without a title it throws; right side appends", () => {
  const svg = Plot.plot({ marks: [dot()] }) as SVGSVGElement;
  expect(() => titleImage(svg, { image: "KC", league: "nfl" })).toThrow(InputError);
  const out = titleImage(svg, { image: "https://example.test/a.png", title: "T", side: "right" });
  expect(out.tagName.toLowerCase()).toBe("figure");
  expect((out.querySelector("h2") as Element).lastElementChild?.tagName.toLowerCase()).toBe("img");
  const svg2 = Plot.plot({ marks: [dot()] }) as SVGSVGElement;
  expect(() => titleImage(svg2, { image: "http://insecure.test/a.png", title: "T" })).toThrow(/https/);
});
test("an unknown team draws the title alone", () => {
  setWarningHandler(() => {});
  try {
    const fig = Plot.plot({ title: "T", marks: [dot()] }) as HTMLElement;
    const out = titleImage(fig, { image: "XXX", league: "nfl" });
    expect(out).toBe(fig);
    expect(out.querySelector("h2 img")).toBeNull();
  } finally {
    setWarningHandler(null);
  }
});
test("a throwing call leaves the caller's svg where it was", () => {
  const div = document.createElement("div");
  const svg = Plot.plot({ marks: [dot()] }) as SVGSVGElement;
  div.append(svg);
  expect(() => titleImage(svg, { image: "http://insecure/x.png", title: "T" })).toThrow(/https/);
  expect(svg.parentElement).toBe(div);
});
