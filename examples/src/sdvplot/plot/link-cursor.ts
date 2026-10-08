import * as Plot from "@observablehq/plot";
import { BKN_SHOTS_2026 } from "@sportsdataverse/examples/data";
import { createSelection } from "@sportsdataverse/sdvplot";
import { linkCursor } from "@sportsdataverse/sdvplot/interact";
import { surface } from "@sportsdataverse/sdvplot/plot";
import { fgPctByDistance, statsBySide } from "@sportsdataverse/sdvplot/shots";
import { toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "linkCursor: one shot distance, followed by four Brooklyn charts through their own scales",
  tags: [
    "plot",
    "linkCursor",
    "createSelection",
    "fgPctByDistance",
    "statsBySide",
    "surface",
    "toSurfaceFrame",
    "cursor",
    "linked",
    "shots",
    "nba",
  ],
} satisfies ExampleMeta;

// Brooklyn's 2025-26 shots. The store holds ONE number, the shot distance under the pointer; each chart draws it
// through its own scale. Hover the share bars, the FG% bars or the side chart: every cursor follows, and the ring
// around the hoop shows how far out that is. Leaving a chart clears them all.
const D = "shot_distance";
const byFoot = fgPctByDistance(BKN_SHOTS_2026, 1, 35);
const by3 = fgPctByDistance(BKN_SHOTS_2026, 3, 35);
const sides = statsBySide(BKN_SHOTS_2026, 1, 35); // x == 0 counts as centre
const within = byFoot.reduce((n, b) => n + b.attempts, 0);
const snap = (feet: number): number => Math.floor(feet) + 0.5; // one value per 1 ft bin
const store = createSelection();

// Share of attempts by foot, on a linear x: a band one foot wide, with master's readout (it flips near 35 ft)
const share = Plot.plot({
  width: 640,
  height: 220,
  x: { label: "Shot distance (ft)" },
  y: { label: "Share of attempts (%)", percent: true },
  marks: [Plot.rectY(byFoot, { x1: "distance", x2: (b) => b.distance + 1, y: "share", inset: 0.5 })],
});
linkCursor(share, store, {
  field: D,
  shape: { axis: "x", scale: share.scale("x")!, width: 1 },
  snap,
  label: (feet) => {
    const b = byFoot[Math.floor(feet)];
    return b === undefined
      ? []
      : [`${(100 * b.share).toFixed(1)}%`, `${b.attempts} of ${within}`, `@ ${b.distance} ft`];
  },
});

// FG% in 3 ft bins, on a band x (no invert): the cursor lights the band holding the distance
const fg = Plot.plot({
  width: 640,
  height: 220,
  x: { label: "Shot distance (ft, 3 ft bins)" },
  y: { label: "FG%", percent: true, domain: [0, 1] },
  marks: [Plot.barY(by3, { x: "distance", y: "fgPct" })],
});
linkCursor(fg, store, { field: D, shape: { axis: "x", scale: fg.scale("x")! } });

// Attempts left and right of the hoop by foot, distance on y: the same value as a horizontal band
const side = Plot.plot({
  width: 320,
  height: 420,
  x: { label: "← left   attempts   right →", tickFormat: Math.abs },
  y: { label: "Shot distance (ft)" },
  marks: [
    Plot.rect(sides, { x1: (b) => -b.left.attempts, x2: 0, y1: "distance", y2: (b) => b.distance + 1 }),
    Plot.rect(sides, { x1: 0, x2: (b) => b.right.attempts, y1: "distance", y2: (b) => b.distance + 1 }),
    Plot.ruleX([0]),
  ],
});
linkCursor(side, store, { field: D, shape: { axis: "y", scale: side.scale("y")!, width: 1 }, snap });

// The shots on the defensive half court, and a ring around the hoop (-41.75, 0) at the cursor's distance
// (spread into plain rows: toSurfaceFrame takes any record, and an interface type is not one)
const shots = toSurfaceFrame(
  BKN_SHOTS_2026.map((s) => ({ ...s })),
  { from: "nba-legacy" },
);
const court = surface("nba", { displayRange: "defense" });
const chart = Plot.plot({
  ...court.scales,
  width: 640,
  marks: [
    ...court.marks,
    Plot.dot(shots, { x: "surface_x", y: "surface_y", r: 1.5, fill: "shot_result", fillOpacity: 0.6 }),
  ],
});
linkCursor(chart, store, {
  field: D,
  shape: { axis: "ring", x: chart.scale("x")!, y: chart.scale("y")!, center: [-41.75, 0] },
});

store.set({ cursor: { field: D, value: 26.5 } }); // just behind the arc above the break: Brooklyn's busiest foot
const root = document.createElement("div");
root.append(share, fg, side, chart);
export default root;
