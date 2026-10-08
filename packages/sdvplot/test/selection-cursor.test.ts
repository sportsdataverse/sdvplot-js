// @vitest-environment node
import { expect, test, vi } from "vitest";
import { InputError } from "../src/errors.js";
import { createSelection, focusIds, sameCursor } from "../src/selection.js";

test("starts null; one notification per distinct cursor; an equal cursor (new object) is silent", () => {
  const s = createSelection();
  expect(s.getState().cursor).toBeNull();
  const fn = vi.fn();
  s.subscribe(fn);
  s.set({ cursor: { field: "distance", value: 12.5 } });
  s.set({ cursor: { field: "distance", value: 12.5 } });
  expect(fn).toHaveBeenCalledTimes(1);
  s.set({ cursor: { field: "distance", value: 13.5 } });
  expect(fn).toHaveBeenCalledTimes(2);
  expect(sameCursor({ field: "a", value: 1 }, { field: "b", value: 1 })).toBe(false);
});
test("0 and -0 are the same hover value: equal cursors, no second notification", () => {
  expect(sameCursor({ field: "shot_distance", value: 0 }, { field: "shot_distance", value: -0 })).toBe(true);
  const s = createSelection();
  const fn = vi.fn();
  s.subscribe(fn);
  s.set({ cursor: { field: "shot_distance", value: 0 } });
  s.set({ cursor: { field: "shot_distance", value: -0 } });
  expect(fn).toHaveBeenCalledTimes(1);
});
test("a cursor never dims (Review Focus 7): with only a cursor set, focusIds is null", () => {
  const s = createSelection();
  s.set({ cursor: { field: "distance", value: 3.5 } });
  expect(focusIds(s.getState())).toBeNull();
});
test("hover + cursor in one patch is ONE notification; clear() resets the cursor; a second clear is silent", () => {
  const s = createSelection();
  const fn = vi.fn();
  s.subscribe(fn);
  s.set({ hover: ["KC"], cursor: { field: "distance", value: 1.5 } });
  s.clear();
  s.clear();
  s.set({ cursor: null });
  expect(fn).toHaveBeenCalledTimes(2);
  expect(s.getState().cursor).toBeNull();
});
test("a non-finite value or an empty field throws InputError, with no DOM", () => {
  const s = createSelection();
  expect(() => s.set({ cursor: { field: "distance", value: Number.NaN } })).toThrow(InputError);
  expect(() => s.set({ cursor: { field: "", value: 1 } })).toThrow(InputError);
});
test("the state holds a copy: mutating the patch's cursor afterwards changes nothing", () => {
  const s = createSelection();
  const c = { field: "distance", value: 23.5 };
  s.set({ cursor: c });
  c.value = 24.5;
  expect(s.getState().cursor).toEqual({ field: "distance", value: 23.5 });
});
