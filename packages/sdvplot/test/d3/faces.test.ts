// @vitest-environment jsdom
import { scaleLinear, select } from "d3";
import { expect, test } from "vitest";
import { appendHeadshots } from "../../src/d3/index.js";
import { drawnMarks } from "../../src/testing/index.js";

const s = scaleLinear([0, 10], [0, 100]);
const pos = {
  x: (v: unknown) => s(Number(v)),
  y: (v: unknown) => s(Number(v)),
  frameHeight: 100,
  height: 0.2,
};
// Real ESPN ids from the bundled nflverse gsis shard (src/data/nfl_gsis.ts), named by joining its headshot slugs to
// the nfl-ngs-data 2025 receivers: Patrick Mahomes 00-0033873, Amon-Ra St. Brown 00-0036963, De'Von Achane 00-0039040.
const MAHOMES = "3139477";
const ST_BROWN = "4374302";
const ACHANE = "4429160";

test("clip: 'circle' makes a face: clipped image 2.3 R tall, 1.05 R above centre, ring and placeholder", () => {
  const svg = select(document.body).append("svg");
  appendHeadshots(svg, [5], [5], [MAHOMES], {
    league: "nfl",
    ...pos,
    clip: "circle",
    ring: "#e31837",
    placeholder: (id) => (id === MAHOMES ? "#e31837" : "grey"),
  });
  const img = svg.select("image");
  expect(svg.select("clipPath circle").attr("r")).toBe("10"); // diameter = 0.2 x 100 px
  expect(img.attr("clip-path")).toMatch(/^url\(#sdv-face-[0-9a-z]+\)$/);
  expect(Number(img.attr("height"))).toBeCloseTo(23, 9);
  expect(Number(img.attr("y"))).toBeCloseTo(50 - 10.5, 9);
  expect(svg.selectAll("circle[stroke='#e31837']").size()).toBe(1);
  expect(svg.selectAll("circle[fill-opacity='0.35']").size()).toBe(1);
  expect(img.attr("data-sdv-id")).toBe(MAHOMES); // the testing hooks still read it
});

test("faces per player: one clipPath each, centred on its player, ring and placeholder by id; drawnMarks still reads them", () => {
  const svg = select(document.body).append("svg");
  const team: Record<string, string> = { [MAHOMES]: "#e31837", [ST_BROWN]: "#0076b6", [ACHANE]: "#008e97" };
  appendHeadshots(svg, [2, 5, 8], [3, 5, 7], [MAHOMES, ST_BROWN, ACHANE], {
    league: "nfl",
    ...pos,
    clip: "circle",
    ring: (id) => team[id] ?? "grey",
    placeholder: (id) => team[id] ?? "grey",
  });
  const root = svg.node() as SVGSVGElement;
  const images = [...root.querySelectorAll("image")];
  expect(images.map((i) => i.getAttribute("data-sdv-id"))).toEqual([MAHOMES, ST_BROWN, ACHANE]);
  for (const [i, img] of images.entries()) {
    const id = /^url\(#(.+)\)$/.exec(img.getAttribute("clip-path") ?? "")?.[1] ?? "";
    const disc = root.querySelector(`clipPath[id="${id}"] circle`);
    expect([disc?.getAttribute("cx"), disc?.getAttribute("cy")]).toEqual([
      String([20, 50, 80][i]),
      String([30, 50, 70][i]),
    ]);
    expect(img.getAttribute("href")).toContain(`/nfl/players/full/${img.getAttribute("data-sdv-id")}.png`);
  }
  expect(new Set(images.map((i) => i.getAttribute("clip-path"))).size).toBe(3);
  expect(
    [...root.querySelectorAll("circle[stroke-width='1.5']")].map((c) => c.getAttribute("stroke")),
  ).toEqual(["#e31837", "#0076b6", "#008e97"]);
  // The image is cropped by the circle, so the drawn <image> is 1.15 x the face's diameter (2.3 R / 2 R).
  expect(drawnMarks(root).map((m) => [m.id, m.x, m.y, Number(m.height.toFixed(9))])).toEqual([
    [MAHOMES, 2, 3, 0.23],
    [ST_BROWN, 5, 5, 0.23],
    [ACHANE, 8, 7, 0.23],
  ]);
});

test("the clip id is a content hash: the same face twice gets the same id, another place another id", () => {
  const face = (x: number) => {
    const svg = select(document.body).append("svg");
    appendHeadshots(svg, [x], [5], [MAHOMES], { league: "nfl", ...pos, clip: "circle" });
    return svg.select("image").attr("clip-path");
  };
  expect(face(5)).toBe(face(5));
  expect(face(5)).not.toBe(face(6));
});

test("without clip, appendHeadshots is unchanged: no clipPath, no circles", () => {
  const svg = select(document.body).append("svg");
  appendHeadshots(svg, [5], [5], [MAHOMES], { league: "nfl", ...pos });
  expect(svg.selectAll("clipPath, circle").size()).toBe(0);
  expect(Number(svg.select("image").attr("height"))).toBeCloseTo(20, 9);
  expect(svg.select("image").attr("clip-path")).toBeNull();
});
