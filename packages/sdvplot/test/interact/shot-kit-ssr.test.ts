// @vitest-environment node
// Phase 10 Task 10 in Node: the shot kit's three figures rendered on a server are byte-identical whether or not ACTIVE
// stores (a cursor, a hover, a selection) are linked to them. Plot gets a jsdom document, the Phase 8 Task 5 way.
import { JSDOM } from "jsdom";
import { expect, test } from "vitest";
import { createSelection } from "../../src/selection.js";
import type { BknShot } from "../shots/fixture.js";
import { D, type Kit, kit, linkKit } from "./_dashboard.js";

test("the three kit figures rendered in Node with an ACTIVE store (cursor, hover, selected) are byte-identical to the unlinked render", () => {
  expect(typeof window).toBe("undefined");
  const html = (k: Kit): string[] => k.figures.map((f) => f.outerHTML);
  const before = html(kit({ document: new JSDOM("").window.document }));
  const k = kit({ document: new JSDOM("").window.document });
  const store = createSelection<BknShot>();
  const zones = createSelection<BknShot>();
  // ACTIVE before linking
  store.set({ cursor: { field: D, value: 12.5 }, hover: ["0,0"], selected: ["0,0"] });
  zones.set({ hover: ["paint"], selected: ["paint", "mid_range"] });
  const off = linkKit(k, store, zones);
  store.set({ cursor: { field: D, value: 26.5 }, selected: ["0,0", "25.980762113533157,0"] }); // and a change after
  zones.set({ selected: ["paint"] });
  expect(html(k)).toEqual(before);
  off();
  expect(html(k)).toEqual(before);
  expect(before[0]).toContain('data-sdv-id="0,0"'); // the stamps ARE server output
  expect(before[0]).toContain('data-sdv-id="25.980762113533157,0"');
  expect(before[1]).toContain('data-sdv-id="paint"');
  expect(before.join("")).not.toContain('role="checkbox"'); // the checkboxes are the browser's, added on linking
  expect(store.getState().cursor).toEqual({ field: D, value: 26.5 }); // nothing inert wrote to the stores
  expect([...store.getState().hover, ...zones.getState().hover]).toEqual(["0,0", "paint"]);
});
