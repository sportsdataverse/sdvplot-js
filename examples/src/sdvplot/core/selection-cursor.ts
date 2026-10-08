import { BKN_SHOTS_2026 } from "@sportsdataverse/examples/data";
import { type Cursor, createSelection, focusIds, sameCursor } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "A shared hover value: one cursor every linked chart draws through its own scale",
  tags: ["createSelection", "sameCursor", "focusIds", "cursor", "linked", "selection", "shots", "nba"],
} satisfies ExampleMeta;

// A pointer over Brooklyn's distance bars snaps to the centre of its 1 ft bin: the one value the shot chart's ring,
// the signature's rule and the side chart's band all draw.
const bin = (feet: number): Cursor => ({ field: "shot_distance", value: Math.floor(feet) + 0.5 });

const store = createSelection();
let updates = 0;
store.subscribe(() => updates++);

// Sweep the pointer from the rim out, over every shot's distance: a new bin notifies once, the rest are silent.
const feet = BKN_SHOTS_2026.map((s) => s.shot_distance).sort((a, b) => a - b);
for (const d of feet) store.set({ cursor: bin(d) });
const last = store.getState().cursor;
const focus = focusIds(store.getState()); // null: a cursor is not an id, so nothing dims
const atLastBin = updates;
store.set({ cursor: null }); // the pointer leaves the chart

export default {
  "pointer moves": feet.length,
  "1 ft bins with a shot": new Set(feet.map(Math.floor)).size,
  "notifications during the sweep": atLastBin,
  "cursor at the end of the sweep": last,
  "the same bin, a new object": sameCursor(last, bin(39)),
  "focus while the cursor is set": focus,
  "notifications after the pointer leaves": updates,
};
