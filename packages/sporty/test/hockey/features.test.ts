import { expect, test } from "vitest";
import { boards, goalCreaseFill, goalCreaseOutline } from "../../src/hockey/features.js";
import { createCircle } from "../../src/shapes.js";

const near = (got: readonly number[] | undefined, want: readonly number[]): void => {
  expect(got).toBeDefined();
  want.forEach((v, i) => expect(got![i]).toBeCloseTo(v, 10));
};

test("boards: inner arcs at r (0.5π→0, 0→−0.5π), then outer arcs at r + thickness (−0.5π→0, 0→0.5π)", () => {
  const [L, W, r, t, n] = [200, 85, 28, 0.4167, 4];
  const pts = boards({ rinkLength: L, rinkWidth: W, featureRadius: r, featureThickness: t, npoints: n });
  const c = [L / 2 - r, W / 2 - r] as const;
  const arc = (cy: number, start: number, end: number, rr: number) =>
    createCircle({ center: [c[0], cy], start, end, r: rr, npoints: n });
  expect(pts).toEqual([
    [0, W / 2],
    ...arc(c[1], 0.5, 0, r),
    [L / 2, 0],
    ...arc(-c[1], 0, -0.5, r),
    [0, -W / 2],
    [0, -W / 2 - t],
    ...arc(-c[1], -0.5, 0, r + t),
    [L / 2 + t, 0],
    ...arc(c[1], 0, 0.5, r + t),
    [0, W / 2 + t],
    [0, W / 2],
  ]);
  near(pts[4], [L / 2, c[1]]); // inner upper arc ends on the end boards
  near(pts[15], [L / 2 + t, -c[1]]); // outer lower arc ends on the outer end boards
});

test("goalCreaseOutline nhl98: radius-6 arc cut at the crease width, notches at notch_dist_x", () => {
  const o = {
    featureRadius: 6,
    featureThickness: 0.1666,
    creaseStyle: "NHL98",
    creaseLength: 4.5,
    creaseWidth: 8,
    notchDistX: 4,
    notchWidth: 0.4167,
    npoints: 5,
  };
  const pts = goalCreaseOutline(o);
  const theta = Math.acos(4 / 6) / Math.PI;
  expect(pts).toHaveLength(2 + 5 + 8 + 5 + 7);
  expect(pts.slice(0, 2)).toEqual([
    [0, 4],
    [-4.5, 4],
  ]);
  near(pts[2], [6 * Math.cos((0.5 + theta) * Math.PI), 6 * Math.sin((0.5 + theta) * Math.PI)]);
  near(pts[6], [6 * Math.cos((1.5 - theta) * Math.PI), 6 * Math.sin((1.5 - theta) * Math.PI)]);
  const t = o.featureThickness;
  expect(pts.slice(7, 15)).toEqual([
    [-4.5, -4],
    [0, -4],
    [0, -4 + t],
    [-4, -4 + t],
    [-4, -4 + t + o.notchWidth],
    [-(4 + t), -4 + t + o.notchWidth],
    [-(4 + t), -4 + t],
    [-4.5, -4 + t],
  ]);
  near(pts[15], [(6 - t) * Math.cos((1.5 - theta) * Math.PI), (6 - t) * Math.sin((1.5 - theta) * Math.PI)]);
  expect(pts.at(-1)).toEqual([0, 4]);
});

test("crease builders: an unknown style is R's switch default, a single (0, 0) point", () => {
  expect(goalCreaseOutline({ creaseStyle: "nhl2030", featureRadius: 6 })).toEqual([[0, 0]]);
  expect(goalCreaseFill({ creaseStyle: "", featureRadius: 6 })).toEqual([[0, 0]]);
});
