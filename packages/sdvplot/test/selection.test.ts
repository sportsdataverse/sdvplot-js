// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { STANDINGS, type Standing } from "../../sdvtables/test/fixtures/standings.js";
import { createSelection, focusIds, sameIds, toId } from "../src/selection.js";

describe("createSelection", () => {
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
