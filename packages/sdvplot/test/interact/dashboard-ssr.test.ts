// @vitest-environment node
// Phase 8 acceptance in Node (plan Task 12, Review Focus 12): the linked dashboard's five figures rendered on a server
// are byte-identical whether or not a store with an ACTIVE cursor and hover is linked to them.
import { JSDOM } from "jsdom";
import { describe, expect, test } from "vitest";
import { createSelection } from "../../src/selection.js";
import type { BknShot } from "../shots/fixture.js";
import { D, type Shape, dashboard, link } from "./_dashboard.js";

describe.each<Shape>(["hex", "square"])("%s cells", (shape) => {
  test("the five figures rendered in Node with an ACTIVE cursor and hover are byte-identical to the unlinked render (RF 12)", () => {
    expect(typeof window).toBe("undefined");
    const html = (d: ReturnType<typeof dashboard>): string[] => d.figures.map((f) => f.outerHTML);
    const before = html(dashboard(shape, new JSDOM("").window.document));
    const d = dashboard(shape, new JSDOM("").window.document);
    const cell = d.court.querySelector("[data-sdv-id]")?.getAttribute("data-sdv-id"); // a drawn cell, "x,y"
    if (!cell) throw new Error("no cells");
    const store = createSelection<BknShot>();
    store.set({ cursor: { field: D, value: 12.5 }, hover: [cell] }); // ACTIVE before linking
    const off = link(d, store);
    store.set({ cursor: { field: D, value: 26.5 } }); // and a change after
    expect(html(d)).toEqual(before);
    off();
    expect(html(d)).toEqual(before);
    expect(before[0]).toContain(`data-sdv-id="${cell}"`); // the stamps ARE server output
    expect(before[0]).toContain('aria-label="tip"'); // the court's one empty tip group, with or without a store
    expect(store.getState().cursor).toEqual({ field: D, value: 26.5 }); // nothing inert wrote to the store
  });
});
