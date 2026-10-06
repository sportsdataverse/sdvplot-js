import { expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import type { Scene } from "../src/scene.js";
import { toSVG } from "../src/svg.js";

test("toSVG: valid root, viewBox from bbox, one path per polygon, y flipped", () => {
  const s = basketballCourt("nba");
  const svg = toSVG(s, { width: 1100 });
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  expect(svg).toContain('viewBox="-55 -30 110 60"');
  expect(svg).toContain('width="1100"');
  expect(svg).toContain('height="600"');
  expect((svg.match(/<path /g) ?? []).length).toBe(
    s.features.filter(
      (f) =>
        f.kind === "polygon" && !(f.fill.length === 9 && f.fill.endsWith("00") && f.stroke === undefined),
    ).length,
  );
  expect(svg).toContain('transform="scale(1,-1)"');
  expect(svg).toMatch(/fill="#d2ab6f"/);
});

test("hidden features (#00000000) are omitted; no NaN ever", () => {
  const svg = toSVG(basketballCourt("nba", { colorUpdates: { net: "#00000000" } }));
  expect(svg).not.toContain("NaN");
  expect(svg).not.toMatch(/fill="#00000000"/);
});

const base: Scene = {
  sport: "basketball",
  league: "x",
  units: "ft",
  bbox: [0, 0, 10, 5],
  origin: "center",
  features: [],
};

test("text features: upright, escaped, font-size from fitBox; non-finite text skipped", () => {
  const svg = toSVG({
    ...base,
    features: [
      {
        kind: "text",
        name: "t",
        zIndex: 1,
        fill: "#112233",
        x: 1,
        y: 2,
        text: "A & B <c>",
        fontFamily: "Arial",
        fitBox: [4, 0.5],
        rotation: 90,
      },
      {
        kind: "text",
        name: "bad",
        zIndex: 2,
        fill: "#112233",
        x: Number.NaN,
        y: 2,
        text: "no",
        fontFamily: "Arial",
        fitBox: [4, 1],
        rotation: 0,
      },
    ],
  });
  expect(svg).toContain("A &amp; B &lt;c&gt;");
  expect(svg).toContain('transform="scale(1,-1) rotate(-90)"');
  expect(svg).toContain('font-size="0.5"');
  expect(svg).toContain('viewBox="0 -5 10 5"');
  expect(svg).not.toContain(">no<");
});

test("non-finite polygons skipped; -0 prints 0; background first; stroke-only hidden fill", () => {
  const svg = toSVG(
    {
      ...base,
      background: "#395d33",
      features: [
        {
          kind: "polygon",
          name: "nan",
          zIndex: 1,
          fill: "#ff0000",
          points: [
            [0, 0],
            [Number.NaN, 1],
            [1, 1],
          ],
        },
        {
          kind: "polygon",
          name: "ok",
          zIndex: 2,
          fill: "#00000000",
          stroke: "#0000ff",
          points: [
            [-0, 0],
            [1, 0],
            [1, 1],
          ],
        },
      ],
    },
    { precision: 2 },
  );
  expect(svg).not.toContain("NaN");
  expect((svg.match(/<path /g) ?? []).length).toBe(1);
  expect(svg).toContain('fill="none"');
  expect(svg).toContain('d="M 0 0 L 1 0 L 1 1 Z"');
  expect(svg).toContain('<rect x="0" y="0" width="10" height="5" fill="#395d33"/>');
  expect(svg.indexOf("<rect")).toBeLessThan(svg.indexOf("<path"));
});
