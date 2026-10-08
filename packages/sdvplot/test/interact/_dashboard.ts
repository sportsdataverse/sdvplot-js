// The Phase 8 acceptance dashboard (plan Task 12, A11, A17, A23, A33): blazing-the-nets master's five linked charts
// (src/containers/Charts/index.js @35dfda6) rebuilt on the merged shot kit over Brooklyn's 2000 real shots, all on one
// store. Test-only; dashboard.test.ts drives it in jsdom and dashboard-ssr.test.ts renders it in Node.
import * as Plot from "@observablehq/plot";
import { BASKETBALL_ZONE_LABELS } from "@sportsdataverse/sporty";
import { linkCursor, linkSelection } from "../../src/interact/index.js";
import { shootingSignature, shotCells, surface } from "../../src/plot/index.js";
import type { SelectionStore } from "../../src/selection.js";
import {
  type CellVsLeague,
  type DistanceBin,
  type SideBin,
  cellsVsLeague,
  fgPctByDistance,
  signaturePoints,
  sizeCells,
  statsBySide,
  vsLeague,
} from "../../src/shots/index.js";
import { BKN, type BknShot, LEAGUE, LEAGUE_SQUARE } from "../shots/fixture.js";

/** The one cursor field every figure follows. */
export const D = "distance";
/** `FRAMES["nba-legacy-vertical"]` puts the hoop at (0, -47 + 5.25): the ring's centre. */
export const HOOP = -41.75;
/** One value per 1-ft bin (master `BarChart/Cursor.js:18`, `x(d + 0.5)`). */
const snap = (feet: number): number => Math.floor(feet) + 0.5;

export const byFoot: DistanceBin[] = fgPctByDistance(BKN, 1, 35);
export const by3: DistanceBin[] = fgPctByDistance(BKN, 3, 35);
export const sides: SideBin[] = statsBySide(BKN, 1, 35, 0); // x == 0 is the centre column
const within = byFoot.reduce((n, b) => n + b.attempts, 0);
const pct = (v: number | null): string => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);
const pts = (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}`;
/** main's four tip lines (`lib/charts/hexShotChart.ts:183-189`), as Plot's tip text (A23). */
const title = (h: CellVsLeague): string =>
  [
    BASKETBALL_ZONE_LABELS[h.zone],
    `${h.makes}/${h.attempts} FG, ${pct(h.fgPct)}`,
    `League ${pct(h.leagueFgPct)}${h.fgPct !== null && h.leagueFgPct !== null ? ` (${pts(h.fgPct - h.leagueFgPct)})` : ""}`,
    `${h.meanDistance.toFixed(1)} ft`,
  ].join("\n");

export type Shape = "hex" | "square";
export type Fig = ReturnType<typeof Plot.plot>;
export interface Dashboard {
  readonly court: Fig;
  readonly signature: Fig;
  readonly share: Fig;
  readonly fg: Fig;
  readonly side: Fig;
  /** The five, in master's order. */
  readonly figures: readonly Fig[];
  /** The court's cells; a drawn cell's `data-sdv-id` is `"x,y"`. */
  readonly cells: readonly CellVsLeague[];
}

/** The five figures, unlinked. `document` renders them in Node (Plot's own option). A17: hexagons or squares. */
export function dashboard(shape: Shape, document?: Document): Dashboard {
  const doc = document === undefined ? {} : { document };
  // hexagons of radius 10 or squares of the same area (A17: NBA_LEAGUE_SQUARE_2026), each against its league index
  const index = shape === "hex" ? LEAGUE.hex10 : LEAGUE_SQUARE;
  const cells = cellsVsLeague(BKN, index);
  const c = surface("nba", { displayRange: "defense", rotation: 90 }); // hoop at the bottom (A33)
  const court = Plot.plot({
    ...c.scales,
    ...doc,
    width: 500,
    marks: [
      ...c.marks,
      shotCells(cells, {
        r: sizeCells(cells, index).r,
        shape,
        frame: "nba-legacy-vertical",
        tip: { maxRadius: 18 },
        title,
      }),
    ],
  });
  const signature = Plot.plot({
    ...doc,
    width: 640,
    height: 240,
    x: { label: "Shot distance (ft)" },
    y: { domain: [0, 1], label: "FG%", tickFormat: "%" },
    marks: shootingSignature(signaturePoints(vsLeague(byFoot, LEAGUE.byFoot)), { curve: "basis" }),
  });
  const share = Plot.plot({
    ...doc,
    width: 640,
    height: 220,
    x: { label: "Shot distance (ft)" },
    y: { label: "Share of attempts (%)", percent: true },
    marks: [Plot.rectY(byFoot, { x1: "distance", x2: (b) => b.distance + 1, y: "share", inset: 0.5 })],
  });
  const fg = Plot.plot({
    ...doc,
    width: 640,
    height: 220,
    x: { label: "Shot distance (ft, 3 ft bins)" },
    y: { label: "FG%", percent: true, domain: [0, 100] }, // percent scales by 100 before the domain applies
    marks: [Plot.barY(by3, { x: "distance", y: "fgPct" })],
  });
  // main's side chart (lib/charts/sideChart.ts:20-22, :66-75): a FIXED centre column on its own narrower scale, left
  // growing leftward and right rightward from its edges on one shared scale
  const top = Math.max(...sides.flatMap((b) => [b.left.attempts, b.centre.attempts, b.right.attempts]));
  const G = (top * 28) / 187; // half the column: main's 56 px beside 187 px a side at its 500 px width
  const mid = (b: SideBin): number => (G * b.centre.attempts) / top; // half a centre bar: `top` fills the column
  const band = {
    y1: "distance",
    y2: (b: SideBin) => b.distance + 1,
    insetTop: 0.5,
    insetBottom: 0.5,
  } as const;
  const side = Plot.plot({
    ...doc,
    width: 320,
    height: 420,
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
  return { court, signature, share, fg, side, figures: [court, signature, share, fg, side], cells };
}

const scale = (f: Fig, n: "x" | "y"): Plot.Scale => {
  const s = f.scale(n);
  if (s === undefined) throw new Error(`no ${n} scale`);
  return s;
};

/** Link the five to one store as master linked them (one shared distance) plus the court's cell hover (A20, A33). */
export function link(d: Dashboard, store: SelectionStore<BknShot>): () => void {
  const offs = [
    linkCursor(d.court, store, {
      field: D,
      shape: { axis: "ring", x: scale(d.court, "x"), y: scale(d.court, "y"), center: [0, HOOP] },
    }),
    linkSelection(store, { figure: d.court, hover: { id: (h: CellVsLeague) => `${h.x},${h.y}` } }),
    linkCursor(d.signature, store, {
      field: D,
      shape: { axis: "x", scale: scale(d.signature, "x") },
      emit: false,
    }),
    linkCursor(d.share, store, {
      field: D,
      shape: { axis: "x", scale: scale(d.share, "x"), width: 1 },
      snap,
      // master BarChart/Cursor.js:24-27 with its shotProportion labeler (BarChart/functions.js:19-25)
      label: (feet) => {
        const b = byFoot[Math.floor(feet)];
        return b === undefined
          ? []
          : [
              `${((100 * b.attempts) / within).toFixed(2)}%`,
              `~ ${b.attempts} / ${within}`,
              `@ ${b.distance} ft`,
            ];
      },
    }),
    linkCursor(d.fg, store, { field: D, shape: { axis: "x", scale: scale(d.fg, "x") } }),
    linkCursor(d.side, store, { field: D, shape: { axis: "y", scale: scale(d.side, "y"), width: 1 }, snap }),
  ];
  return () => {
    for (const off of offs) off();
  };
}
