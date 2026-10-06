import { expect, test } from "vitest";
import { emitSport, inferFieldType } from "./emit-sport.js";
test("infers array-normalized types across leagues", () => {
  const leagues = {
    nba: {
      center_circle_radius: [6, 2.1667],
      court_units: "ft",
      lane_lower_defensive_box_marks_visibility: true,
      lane_space_mark_lengths: [[0.1667], [1]],
    },
    fiba: {
      center_circle_radius: 1.8,
      court_units: "m",
      lane_lower_defensive_box_marks_visibility: false,
      lane_space_mark_lengths: [[0.05]],
    },
  };
  expect(inferFieldType("center_circle_radius", leagues)).toBe("readonly number[]");
  expect(inferFieldType("court_units", leagues)).toBe('"ft" | "m"');
  expect(inferFieldType("lane_lower_defensive_box_marks_visibility", leagues)).toBe("boolean");
  expect(inferFieldType("lane_space_mark_lengths", leagues)).toBe("readonly (readonly number[])[]");
  const src = emitSport("basketball", leagues);
  expect(src).toContain("export interface BasketballParams");
  expect(src).toContain('"center_circle_radius":[1.8]'); // scalar normalized to array in the emitted spec
});
test("an empty array is flat, not 2-D", () => {
  expect(inferFieldType("x", { a: { x: [] }, b: { x: [1, 2] } })).toBe("readonly number[]");
  expect(inferFieldType("x", { a: { x: [] }, b: { x: [[1], [2]] } })).toBe("readonly (readonly number[])[]");
});
