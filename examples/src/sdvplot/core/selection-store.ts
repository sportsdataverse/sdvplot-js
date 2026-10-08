import { STANDINGS, type Standing } from "@sportsdataverse/examples/data";
import { createSelection, focusIds, sameIds, toId } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The selection store behind linked figures and tables",
  tags: ["createSelection", "focusIds", "sameIds", "toId", "linked", "selection", "nfl"],
} satisfies ExampleMeta;

const store = createSelection<Standing>();
let updates = 0;
store.subscribe(() => updates++);
const idle = focusIds(store.getState()); // null: nothing is active, draw everything normally

// A brush over the 11+ win teams writes the ids it encloses and the region as a row test (a table's external filter).
const winners = (r: Standing): boolean => r.wins >= 11;
store.set({ selected: STANDINGS.filter(winners).map((r) => toId(r.team)), predicate: winners });
const brushed = store.getState().selected;
store.set({ selected: [...brushed].reverse() }); // the same ids in another order: silent, so links cannot ping-pong
store.set({ hover: ["MIA"] }); // a table row under the pointer

const state = store.getState();
export default {
  idle,
  updates,
  "same ids after the reorder": sameIds(state.selected, brushed),
  "table rows the predicate keeps": STANDINGS.filter((r) => state.predicate?.(r)).map((r) => r.team),
  "focus (selected and hover)": [...(focusIds(state) ?? [])],
  "toId(null) never matches": toId(null),
};
