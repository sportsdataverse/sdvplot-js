import * as Plot from "@observablehq/plot";
import { BKN_SHOTS_2026, NBA_LEAGUE_2026, NBA_LEAGUE_SQUARE_2026 } from "@sportsdataverse/examples/data";
import { createSelection } from "@sportsdataverse/sdvplot";
import { linkCursor, linkSelection } from "@sportsdataverse/sdvplot/interact";
import { shootingSignature, shotCells, surface } from "@sportsdataverse/sdvplot/plot";
import {
  type CellVsLeague,
  type SideBin,
  cellsVsLeague,
  fgPctByDistance,
  signaturePoints,
  sizeCells,
  statsBySide,
  vsLeague,
} from "@sportsdataverse/sdvplot/shots";
import { BASKETBALL_ZONE_LABELS } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "A linked shot dashboard: one shot distance across five Brooklyn charts",
  tags: [
    "plot",
    "shots",
    "linkCursor",
    "linkSelection",
    "createSelection",
    "shotCells",
    "shootingSignature",
    "signaturePoints",
    "cellsVsLeague",
    "sizeCells",
    "fgPctByDistance",
    "statsBySide",
    "vsLeague",
    "surface",
    "cursor",
    "linked",
    "nba",
  ],
} satisfies ExampleMeta;

// Brooklyn's first 2000 shots of 2025-26 against the 2025-26 league, linked through ONE store that holds one number,
// the shot distance under the pointer. Hover the share bars, the FG% bars or the side chart: each chart draws that
// distance through its own scale, and the court rings it around the hoop. Hover the court for a cell's numbers.
const D = "shot_distance";
const byFoot = fgPctByDistance(BKN_SHOTS_2026, 1, 35);
const by3 = fgPctByDistance(BKN_SHOTS_2026, 3, 35);
const sides = statsBySide(BKN_SHOTS_2026, 1, 35, 0); // x == 0 is the centre column
const within = byFoot.reduce((n, b) => n + b.attempts, 0);
const snap = (feet: number): number => Math.floor(feet) + 0.5; // one value per 1 ft bin
const pct = (v: number | null): string => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);
const pts = (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}`;
const store = createSelection();

// The court, hoop at the bottom: cells against the league in the same cell, sized by attempts; the tip names a cell's
// zone, makes, league FG% and mean distance. Hexagons of radius 10 or squares of the same area.
const court = surface("nba", { displayRange: "defense", rotation: 90 });
const drawCourt = (shape: "hex" | "square"): { svg: SVGSVGElement | HTMLElement; off: () => void } => {
  const index = shape === "hex" ? NBA_LEAGUE_2026.hex10 : NBA_LEAGUE_SQUARE_2026;
  const cells = cellsVsLeague(BKN_SHOTS_2026, index);
  const svg = Plot.plot({
    ...court.scales,
    width: 460,
    marks: [
      ...court.marks,
      shotCells(cells, {
        r: sizeCells(cells, index).r,
        shape,
        frame: "nba-legacy-vertical",
        tip: { maxRadius: 18 },
        title: (h: CellVsLeague) =>
          [
            BASKETBALL_ZONE_LABELS[h.zone],
            `${h.makes}/${h.attempts} FG, ${pct(h.fgPct)}`,
            `League ${pct(h.leagueFgPct)}${h.fgPct !== null && h.leagueFgPct !== null ? ` (${pts(h.fgPct - h.leagueFgPct)})` : ""}`,
            `${h.meanDistance.toFixed(1)} ft`,
          ].join("\n"),
      }),
    ],
  });
  // the ring around the hoop, (0, -41.75) in the vertical frame, at the shared distance
  const offRing = linkCursor(svg, store, {
    field: D,
    shape: { axis: "ring", x: svg.scale("x")!, y: svg.scale("y")!, center: [0, -41.75] },
  });
  // the cell under Plot's tip lights, the rest dim
  const offHover = linkSelection(store, { figure: svg, hover: { id: (h: CellVsLeague) => `${h.x},${h.y}` } });
  return {
    svg,
    off: () => {
      offRing();
      offHover();
    },
  };
};

// The shooting signature follows the distance with a rule; it never writes one
const signature = Plot.plot({
  width: 460,
  height: 220,
  x: { label: "Shot distance (ft)" },
  y: { domain: [0, 1], label: "FG%", tickFormat: "%" },
  marks: shootingSignature(signaturePoints(vsLeague(byFoot, NBA_LEAGUE_2026.byFoot)), { curve: "basis" }),
});
linkCursor(signature, store, { field: D, shape: { axis: "x", scale: signature.scale("x")! }, emit: false });

// Share of attempts by foot on a linear x: a 1 ft band with master's readout
const share = Plot.plot({
  width: 460,
  height: 200,
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
      : [`${((100 * b.attempts) / within).toFixed(2)}%`, `~ ${b.attempts} / ${within}`, `@ ${b.distance} ft`];
  },
});

// FG% in 3 ft bins on a band x: the cursor lights the band holding the distance
const fg = Plot.plot({
  width: 460,
  height: 200,
  x: { label: "Shot distance (ft, 3 ft bins)" },
  y: { label: "FG%", percent: true, domain: [0, 100] }, // percent scales by 100 before the domain applies
  marks: [Plot.barY(by3, { x: "distance", y: "fgPct" })],
});
linkCursor(fg, store, { field: D, shape: { axis: "x", scale: fg.scale("x")! } });

// Attempts by side, distance up the y axis, as blazing-the-nets draws them: a FIXED centre column (x == 0) on its own
// narrower scale, left growing leftward and right rightward from its edges, so the axis reads each side from its edge
const top = Math.max(...sides.flatMap((b) => [b.left.attempts, b.centre.attempts, b.right.attempts]));
const G = (top * 28) / 187; // half the column: main's 56 px beside 187 px a side at its 500 px width
const mid = (b: SideBin): number => (G * b.centre.attempts) / top; // half a centre bar: `top` fills the column
const band = { y1: "distance", y2: (b: SideBin) => b.distance + 1, insetTop: 0.5, insetBottom: 0.5 } as const;
const side = Plot.plot({
  width: 300,
  height: 440,
  x: {
    label: "← left   attempts   right →",
    ticks: Array.from({ length: Math.floor(top / 50) + 1 }, (_, i) => [-G - 50 * i, G + 50 * i]).flat(),
    tickFormat: (v: number) => String(Math.round(Math.abs(v) - G)),
  },
  y: { label: "Shot distance (ft)" },
  marks: [
    Plot.ruleX([-G, G], { strokeOpacity: 0.3 }), // the column's edges
    Plot.rect(sides, { ...band, x1: (b) => -G - b.left.attempts, x2: -G }),
    Plot.rect(sides, { ...band, x1: (b) => -mid(b), x2: mid, fillOpacity: 0.5 }),
    Plot.rect(sides, { ...band, x1: G, x2: (b) => G + b.right.attempts }),
  ],
});
linkCursor(side, store, { field: D, shape: { axis: "y", scale: side.scale("y")!, width: 1 }, snap });

// The court's cell shape: a toggle that redraws only the court, on the same store
let current = drawCourt("hex");
const toggle = document.createElement("select");
toggle.setAttribute("aria-label", "Cell shape");
toggle.innerHTML = '<option value="hex">Hexagons</option><option value="square">Squares</option>';
toggle.addEventListener("change", () => {
  current.off(); // first: its teardown clears the hover it wrote, before the new court reads the store
  const next = drawCourt(toggle.value === "square" ? "square" : "hex");
  current.svg.replaceWith(next.svg);
  current = next;
});

store.set({ cursor: { field: D, value: 26.5 } }); // just behind the arc: Brooklyn's busiest foot
const root = document.createElement("div");
root.style.cssText = "display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start";
const left = document.createElement("div");
left.append(toggle, current.svg);
const right = document.createElement("div");
right.append(signature, share, fg);
root.append(left, right, side);
export default root;
