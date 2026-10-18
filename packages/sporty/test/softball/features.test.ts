import { expect, test } from "vitest";
import * as F from "../../src/softball/features.js";

test("battersBox closes each half at half the length (baseball closes at the full length)", () => {
  const b = F.battersBox({
    battersBoxLength: 7,
    battersBoxWidth: 3,
    battersBoxYAdj: 1,
    battersBoxThickness: 0.25,
  });
  expect(b).toHaveLength(18);
  expect(b[8]).toEqual([0, 4.5]);
  expect(b[0]).toEqual([0, 4.5]);
});

test("catchersBox runs from the batter's boxes' back edge, depth deep", () => {
  const c = F.catchersBox({
    catchersBoxDepth: 7,
    catchersBoxWidth: 8,
    battersBoxLength: 7,
    battersBoxYAdj: 1,
  });
  expect(c[0]).toEqual([4, -2.5]);
  expect(c[1]).toEqual([4, -9.5]);
  expect(c).toHaveLength(9);
});

test("foulLine starts at min(outer box x, box front y); 1B runs up-right, 3B up-left", () => {
  const o = { battersBoxLength: 7, battersBoxWidth: 3, battersBoxYAdj: 1.2, homePlateSideToBattersBox: 0.5 };
  const fb = F.foulLine({
    ...o,
    homePlateEdgeLength: 1.4,
    isLine1b: true,
    lineDistance: 190,
    foulLineThickness: 0.25,
  });
  expect(fb[0]).toEqual([4.2, 4.2]); // min(0.7 + 0.5 + 3, 3.5 + 1.2) = 4.2
  expect(fb[1]![0]).toBeCloseTo(190 * Math.SQRT1_2, 9);
  expect(fb[3]).toEqual([3.95, 4.2]);
  const tb = F.foulLine({ ...o, homePlateEdgeLength: 4, lineDistance: 190, foulLineThickness: 0.25 });
  expect(tb[0]).toEqual([-4.7, 4.7]); // min(2 + 0.5 + 3, 4.7)
  expect(tb[1]![0]).toBeCloseTo(-190 * Math.SQRT1_2, 9);
});

test("pitchersLane points from the plate's end toward the box corner; straight down when they coincide", () => {
  const l = F.pitchersLane({
    pitchersLaneLength: 8,
    pitchersPlateLength: 2,
    pitchersPlateFrontToHomePlate: 43,
    homePlateEdgeLength: 2,
    homePlateSideToBattersBox: 0,
    battersBoxLength: 0,
    pitchersLaneThickness: 0.25,
  });
  expect(l[0]).toEqual([1, 0]);
  expect(l[1]![0]).toBeCloseTo(1, 9); // dx = 0 → theta = -π/2
  expect(l[1]![1]).toBeCloseTo(-8, 9);
  const d = F.pitchersLane({ pitchersLaneLength: 3 });
  expect(d[1]![1]).toBeCloseTo(-3, 9);
});

test("coachesBox maps (along, outside) the first-base line onto x/y", () => {
  const c = F.coachesBox({
    baselineDistance: 60,
    coachesBoxDepth: 8,
    coachesBoxLength: 15,
    coachesBoxWidth: 3,
  });
  expect(c).toHaveLength(7);
  expect(c[0]![0]).toBeCloseTo(68 / Math.SQRT2, 9);
  expect(c[0]![1]).toBeCloseTo(52 / Math.SQRT2, 9);
  expect(c[6]).toEqual(c[0]);
});
