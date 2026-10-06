import { expect, test } from "vitest";
import { directionalArrow, fieldApron, majorYardLine, teamBenchArea } from "../../src/football/features.js";

test("majorYardLine: a minor_line_thickness-wide line from sideline to sideline, cross hashes at ±separation/2", () => {
  const [W, t, d, chl, chs] = [53.3333, 0.1111, 0.2222, 0.2778, 6.1667];
  const pts = majorYardLine({
    fieldWidth: W,
    featureThickness: t,
    distToSideline: d,
    crossHashLength: chl,
    crossHashSeparation: chs,
  });
  const [h, o, s, top] = [t / 2, t / 2 + chl, chs / 2, W / 2 - d];
  expect(pts).toEqual([
    [-h, -top],
    [-h, -(s + t)],
    [-o, -(s + t)],
    [-o, -s],
    [-h, -s],
    [-h, s],
    [-o, s],
    [-o, s + t],
    [-h, s + t],
    [-h, top],
    [h, top],
    [h, s + t],
    [o, s + t],
    [o, s],
    [h, s],
    [h, -s],
    [o, -s],
    [o, -(s + t)],
    [h, -(s + t)],
    [h, -top],
    [-h, -top],
  ]);
});

test("directionalArrow: closed triangle, base on x = 0, tip at arrow_length", () => {
  expect(directionalArrow({ arrowBase: 0.5, arrowLength: 0.9682 })).toEqual([
    [0, 0.25],
    [0.9682, 0],
    [0, -0.25],
    [0, 0.25],
  ]);
});

test("teamBenchArea: field side at y = 0, back side at team_bench_width", () => {
  expect(
    teamBenchArea({ teamBenchLengthFieldSide: 40, teamBenchLengthBackSide: 30, teamBenchWidth: 6 }),
  ).toEqual([
    [-20, 0],
    [20, 0],
    [15, 6],
    [-15, 6],
    [-20, 0],
  ]);
});

test("fieldApron: a rectangular bench with equal sides has an infinite slope, so the corner sits at x1 (R quirk)", () => {
  const o = {
    fieldLength: 100,
    fieldWidth: 50,
    teamBenchLengthFieldSide: 60,
    teamBenchLengthBackSide: 60,
    teamBenchWidth: 4,
    teamBenchAreaBorderThickness: 0.1,
    fieldBorderThickness: 1,
  };
  expect(fieldApron({ ...o, benchShape: "Rectangular" })[1]?.[0]).toBeCloseTo(30 + 0.1 + 1, 12);
  // any other shape: back/2 + bench border + field border / 2
  expect(fieldApron({ ...o, benchShape: "trapezoid" })[1]?.[0]).toBeCloseTo(30 + 0.1 + 0.5, 12);
  expect(fieldApron(o)).toHaveLength(17);
});
