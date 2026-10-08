// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { STANDINGS, type Standing } from "../../sdvtables/test/fixtures/standings.js";
import { InputError } from "../src/errors.js";
import { createSelection, focusIds, sameIds, toId } from "../src/selection.js";

describe("createSelection", () => {
  test("a snapshot is read-only at runtime too: its sets and cursor cannot change behind the listeners' backs", () => {
    // a JavaScript caller has no ReadonlySet type to stop it; the empty set every store starts with is shared
    const store = createSelection<Standing>();
    const other = createSelection<Standing>();
    const fn = vi.fn();
    store.subscribe(fn);
    expect(() => (store.getState().selected as Set<string>).add("KC")).toThrow(TypeError);
    expect([...other.getState().selected]).toEqual([]);
    store.set({ selected: ["KC", "BUF"], cursor: { field: "wins", value: 13 } }); // 2024: BUF won 13
    const s = store.getState();
    expect(() => (s.selected as Set<string>).delete("KC")).toThrow(TypeError);
    expect(() => (s.hover as Set<string>).clear()).toThrow(TypeError);
    expect(() => {
      (s.cursor as { value: number }).value = 15;
    }).toThrow(TypeError);
    expect([[...s.selected], s.cursor?.value, fn.mock.calls.length]).toEqual([["KC", "BUF"], 13, 1]);
    store.set({ selected: ["BUF", "KC"] }); // an equal set is still a no-op
    expect([store.getState(), fn.mock.calls.length]).toEqual([s, 1]);
    expect(new Set(s.selected).add("LAC").size).toBe(3); // a copy is the caller's own
  });
  test("starts idle; getState is the same object until a change", () => {
    const s = createSelection<Standing>();
    const a = s.getState();
    expect(a.hover.size + a.selected.size).toBe(0);
    expect(a.predicate).toBeNull();
    expect(s.getState()).toBe(a);
    s.set({ selected: ["KC"] });
    expect(s.getState()).not.toBe(a);
  });
  test("one notification per patch; a patch that changes nothing is silent (the loop guard)", () => {
    const s = createSelection<Standing>();
    const fn = vi.fn();
    s.subscribe(fn);
    const winners = (r: Standing): boolean => r.wins >= 11;
    s.set({ hover: ["BUF"], selected: ["KC", "LAC"], predicate: winners });
    expect(fn).toHaveBeenCalledTimes(1);
    s.set({ hover: ["BUF"], selected: new Set(["LAC", "KC"]), predicate: winners });
    s.set({});
    expect(fn).toHaveBeenCalledTimes(1);
    expect(STANDINGS.filter((r) => s.getState().predicate?.(r)).map((r) => r.team)).toEqual([
      "KC",
      "LAC",
      "BUF",
    ]);
  });
  test("ids are strings: a number from an untyped caller is the same id as its string", () => {
    const s = createSelection();
    s.set({ selected: [12 as unknown as string] });
    const fn = vi.fn();
    s.subscribe(fn);
    s.set({ selected: ["12"] });
    expect(fn).not.toHaveBeenCalled();
    expect([...s.getState().selected]).toEqual(["12"]);
    expect([toId(12), toId(12.0), toId("LV"), toId(null), toId(Number.NaN), toId("")]).toEqual([
      "12",
      "12",
      "LV",
      "",
      "",
      "",
    ]);
  });
  test('ids go through toId: null, undefined, NaN and "" are dropped, never stored as "null"', () => {
    const s = createSelection();
    s.set({ hover: [null, "KC", undefined, Number.NaN, "", 12] as unknown as string[] });
    expect([...s.getState().hover]).toEqual(["KC", "12"]);
  });
  test("a bare string is an InputError, not split into letters, and the patch is not applied", () => {
    const s = createSelection();
    s.set({ selected: ["BUF"] });
    const fn = vi.fn();
    s.subscribe(fn);
    expect(() => s.set({ hover: ["MIA"], selected: "KC" })).toThrow(InputError);
    expect(() => s.set({ hover: "KC" })).toThrow(/\["KC"\]/);
    expect(fn).not.toHaveBeenCalled();
    expect([...s.getState().selected, ...s.getState().hover]).toEqual(["BUF"]);
  });
  test("clear resets all three; a second clear is silent", () => {
    const s = createSelection<Standing>();
    s.set({ hover: ["NE"], selected: ["KC"], predicate: () => true });
    const fn = vi.fn();
    s.subscribe(fn);
    s.clear();
    s.clear();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(focusIds(s.getState())).toBeNull();
  });
  test("a listener that unsubscribes mid-notification does not skip the others", () => {
    const s = createSelection();
    const seen: string[] = [];
    const off = s.subscribe(() => {
      seen.push("a");
      off();
    });
    s.subscribe(() => seen.push("b"));
    s.set({ selected: ["KC"] });
    s.set({ selected: ["BUF"] });
    expect(seen).toEqual(["a", "b", "b"]);
  });
  test("a listener removed during a notification is not called for it (as with EventTarget)", () => {
    const s = createSelection();
    const seen: string[] = [];
    let offB = (): void => {};
    s.subscribe(() => {
      seen.push("a");
      offB();
    });
    offB = s.subscribe(() => seen.push("b"));
    s.set({ selected: ["KC"] });
    expect(seen).toEqual(["a"]);
  });
  test("a listener that throws stops no other listener and not set; its error is reported, never swallowed", () => {
    const reported: (() => void)[] = [];
    const queue = vi.spyOn(globalThis, "queueMicrotask").mockImplementation((cb) => {
      reported.push(cb);
    });
    const s = createSelection();
    const seen: string[] = [];
    const broken = new Error("a linked chart's listener broke");
    s.subscribe(() => {
      seen.push("chart");
      throw broken;
    });
    s.subscribe(() => seen.push("table"));
    try {
      expect(() => s.set({ selected: ["KC"] })).not.toThrow();
    } finally {
      queue.mockRestore();
    }
    expect(seen).toEqual(["chart", "table"]);
    expect([...s.getState().selected]).toEqual(["KC"]);
    expect(reported).toHaveLength(1);
    expect(() => reported[0]?.()).toThrow(broken);
  });
});

describe("focusIds", () => {
  test("null when idle; the EMPTY set for a brush over no point; hover and selected are unioned", () => {
    const s = createSelection<Standing>();
    expect(focusIds(s.getState())).toBeNull();
    s.set({ predicate: () => false, selected: [] });
    expect(focusIds(s.getState())).toEqual(new Set());
    s.set({ predicate: null, selected: ["KC"], hover: ["BUF"] });
    expect(focusIds(s.getState())).toEqual(new Set(["KC", "BUF"]));
    expect(sameIds(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(true);
  });
  test("SSR-inert: the store runs with no DOM at all", () => {
    expect(typeof document).toBe("undefined");
    const s = createSelection();
    s.set({ hover: ["KC"] });
    expect([...s.getState().hover]).toEqual(["KC"]);
  });
});
