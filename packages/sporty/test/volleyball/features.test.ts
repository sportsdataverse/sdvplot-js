import { expect, test } from "vitest";
import { backcourt, freeZone, substitutionZoneDash } from "../../src/volleyball/features.js";

test("freeZone is the 9-point half frame padded by the free zone", () => {
  expect(freeZone({ courtLength: 18, courtWidth: 9, freeZoneEndLine: 6.5, freeZoneSideline: 5 })).toEqual([
    [0, 4.5],
    [9, 4.5],
    [9, -4.5],
    [0, -4.5],
    [0, -9.5],
    [15.5, -9.5],
    [15.5, 9.5],
    [0, 9.5],
    [0, 4.5],
  ]);
});
test("backcourt is centred on its own midpoint (anchor supplies the offset)", () => {
  expect(backcourt({ attackLineEdgeToCenterLine: 3, courtLength: 18, courtWidth: 9 })).toEqual([
    [-3, -4.5],
    [3, -4.5],
    [3, 4.5],
    [-3, 4.5],
    [-3, -4.5],
  ]);
});
test("substitutionZoneDash hangs below-left of its anchor: x -t..0, y 0..dash", () => {
  expect(substitutionZoneDash({ dashLength: 0.15, lineThickness: 0.05 })).toEqual([
    [-0.05, 0],
    [0, 0],
    [0, 0.15],
    [-0.05, 0.15],
    [-0.05, 0],
  ]);
});
