// The Phase 8 acceptance dashboard (plan Task 12, A11, A17, A23, A33): blazing-the-nets master's five linked charts
// (src/containers/Charts/index.js @35dfda6) rebuilt on the merged shot kit over Brooklyn's 2000 real shots, all on one
// store; and Phase 10 Task 10's shot kit (court, zones, signature), built from the same court and signature. Test-only;
// dashboard.test.ts and shot-kit.test.ts drive them in jsdom, dashboard-ssr.test.ts and shot-kit-ssr.test.ts in Node.
import * as Plot from "@observablehq/plot";
import { BASKETBALL_ZONE_LABELS, type BasketballZone, basketballZones } from "@sportsdataverse/sporty";
import { linkCursor, linkSelection } from "../../src/interact/index.js";
import { shootingSignature, shotCells, shotZones, surface } from "../../src/plot/index.js";
import type { SelectionStore } from "../../src/selection.js";
import {
  type CellVsLeague,
  type DistanceBin,
  type LeagueIndex,
  type SideBin,
  cellsVsLeague,
  diffScale,
  fgPctByDistance,
  shrunkDiff,
  signaturePoints,
  sizeCells,
  statsBySide,
  statsByZone,
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
/** main's `fmtPct` and `fmtPts` (`lib/format.ts:4-8`). */
const pct = (v: number | null): string => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);
const pts = (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}`;
/** main's four tip lines (`lib/charts/hexShotChart.ts:183-189`), as Plot's tip text (A23). */
export const mainLines = (h: CellVsLeague): string =>
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

const docOf = (document?: Document): { document?: Document } => (document === undefined ? {} : { document });
/** The NBA half court, hoop at the bottom (A33). */
const nbaCourt = () => surface("nba", { displayRange: "defense", rotation: 90 });

/** BKN's cells against `index` on the court, sized by attempts, with main's tip lines on the cell within 18 px. */
export function courtFigure(
  index: LeagueIndex,
  shape: Shape,
  document?: Document,
): { fig: Fig; cells: CellVsLeague[] } {
  const cells = cellsVsLeague(BKN, index);
  const court = nbaCourt();
  const fig = Plot.plot({
    ...court.scales,
    ...docOf(document),
    width: 500,
    marks: [
      ...court.marks,
      shotCells(cells, {
        r: sizeCells(cells, index).r,
        shape,
        frame: "nba-legacy-vertical",
        // main's nearest hex within 18 px (hexShotChart.ts:164-176); a pinned tip never takes a click meant for a
        // cell under it (a click pins Plot's tip, and a pinned tip takes pointer events)
        tip: { maxRadius: 18, pointerEvents: "none" },
        title: mainLines,
      }),
    ],
  });
  return { fig, cells };
}

/** BKN's shooting signature against the league by foot. */
export function signatureFigure(document?: Document): Fig {
  return Plot.plot({
    ...docOf(document),
    width: 640,
    height: 240,
    x: { label: "Shot distance (ft)" },
    y: { domain: [0, 1], label: "FG%", tickFormat: "%" },
    marks: shootingSignature(signaturePoints(vsLeague(byFoot, LEAGUE.byFoot)), { curve: "basis" }),
  });
}

/** The five figures, unlinked. `document` renders them in Node (Plot's own option). A17: hexagons or squares. */
export function dashboard(shape: Shape, document?: Document): Dashboard {
  const doc = docOf(document);
  // hexagons of radius 10 or squares of the same area (A17: NBA_LEAGUE_SQUARE_2026), each against its league index
  const { fig: court, cells } = courtFigure(shape === "hex" ? LEAGUE.hex10 : LEAGUE_SQUARE, shape, document);
  const signature = signatureFigure(document);
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

export const scaleOf = (f: Fig, n: "x" | "y"): Plot.Scale => {
  const s = f.scale(n);
  if (s === undefined) throw new Error(`no ${n} scale`);
  return s;
};

/** Link the five to one store as master linked them (one shared distance) plus the court's cell hover (A20, A33). */
export function link(d: Dashboard, store: SelectionStore<BknShot>): () => void {
  const offs = [
    linkCursor(d.court, store, {
      field: D,
      shape: { axis: "ring", x: scaleOf(d.court, "x"), y: scaleOf(d.court, "y"), center: [0, HOOP] },
    }),
    linkSelection(store, { plot: d.court, hover: { id: (h: CellVsLeague) => `${h.x},${h.y}` } }),
    linkCursor(d.signature, store, {
      field: D,
      shape: { axis: "x", scale: scaleOf(d.signature, "x") },
      emit: false,
    }),
    linkCursor(d.share, store, {
      field: D,
      shape: { axis: "x", scale: scaleOf(d.share, "x"), width: 1 },
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
    linkCursor(d.fg, store, { field: D, shape: { axis: "x", scale: scaleOf(d.fg, "x") } }),
    linkCursor(d.side, store, {
      field: D,
      shape: { axis: "y", scale: scaleOf(d.side, "y"), width: 1 },
      snap,
    }),
  ];
  return () => {
    for (const off of offs) off();
  };
}

// Phase 10 Task 10's kit (plan Task 10, S11, S22): main's 1.5 ft hexagons against the league, the zones, the signature.
export interface Kit {
  readonly court: Fig;
  readonly zones: Fig;
  readonly signature: Fig;
  /** The three, court first. */
  readonly figures: readonly Fig[];
  /** The court's cells; a drawn cell's `data-sdv-id` is `"x,y"`. */
  readonly cells: readonly CellVsLeague[];
}
const zoneStats = statsByZone(BKN);
const zoneColour = diffScale();
/** A zone's shrunk FG% against the league's in that zone (main's zones mode). */
const zoneFill = (z: BasketballZone): string => {
  const rate = LEAGUE.hex15.zones[z].fgPct;
  return zoneColour(rate === null ? null : shrunkDiff(zoneStats[z].makes, zoneStats[z].attempts, rate));
};

/** The kit's three figures, unlinked. Default: main's chart, radius-15 hexagons against `LEAGUE.hex15`. */
export function kit(o: { index?: LeagueIndex; shape?: Shape; document?: Document } = {}): Kit {
  const { index = LEAGUE.hex15, shape = "hex", document } = o;
  const { fig: courtFig, cells } = courtFigure(index, shape, document);
  const court = nbaCourt();
  const zones = Plot.plot({
    ...court.scales,
    ...docOf(document),
    width: 500,
    marks: [
      ...court.marks,
      ...shotZones(basketballZones("nba", { scale: 10 }), {
        fill: zoneFill,
        text: (z) => `${zoneStats[z].makes}/${zoneStats[z].attempts}`,
        frame: "nba-legacy-vertical",
      }),
    ],
  });
  const signature = signatureFigure(document);
  return { court: courtFig, zones, signature, figures: [courtFig, zones, signature], cells };
}

/**
 * Link the kit. `store`: the court's cells (click-to-select, main's nearest-cell hover) and one shot distance, which
 * the signature emits and the court rings around the hoop. `zones`: the zones by name. Hex ids and zone names are two
 * id spaces: on one store a hovered cell would dim every zone, and the zones figure would warn that none of the linked
 * ids is drawn in it.
 */
export function linkKit(k: Kit, store: SelectionStore<BknShot>, zones: SelectionStore<BknShot>): () => void {
  const offs = [
    linkSelection(store, {
      plot: k.court,
      select: "toggle",
      hover: { id: (h: CellVsLeague) => `${h.x},${h.y}` },
    }),
    linkCursor(k.court, store, {
      field: D,
      shape: { axis: "ring", x: scaleOf(k.court, "x"), y: scaleOf(k.court, "y"), center: [0, HOOP] },
    }),
    linkCursor(k.signature, store, {
      field: D,
      shape: { axis: "x", scale: scaleOf(k.signature, "x") },
      snap,
    }),
    linkSelection(zones, { plot: k.zones, select: "toggle" }),
  ];
  return () => {
    for (const off of offs) off();
  };
}

// Pointer helpers (jsdom), shared by dashboard.test.ts and shot-kit.test.ts.
export const px = (f: Fig, n: "x" | "y", v: number): number => Number(f.scale(n)?.apply(v));
export const span = (f: Fig, n: "x" | "y"): [number, number] => {
  const r = Array.from(f.scale(n)?.range ?? [], Number);
  return [Math.min(...r), Math.max(...r)];
};
export const cursorG = (f: Element): Element | null => f.querySelector("g.sdv-cursor");
export const part = (f: Element, tag: string): Element => {
  const el = cursorG(f)?.querySelector(tag);
  if (!el) throw new Error(`no cursor ${tag}`);
  return el;
};
export const at = (el: Element, a: string): number => Number(el.getAttribute(a));
export const shown = (f: Element): boolean => cursorG(f)?.getAttribute("display") !== "none";
/** A pointer event in svg pixels (jsdom: d3.pointer and Plot's pointer read clientX/Y as svg px; no PointerEvent). */
export const fire = (target: Element, type: string, clientX: number, clientY: number): void => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(e, "pointerType", { value: "mouse" });
  target.dispatchEvent(e);
};

/**
 * A point that is still the nearest of `ps` 17 and 19 px out in one of 8 directions, both probes `inside`: there, only
 * a radius of 18 px tells the two probes apart. Outermost points first (`far`), where such a point is.
 */
export function isolated<T extends { readonly p: readonly [number, number] }>(
  ps: readonly T[],
  far: (t: T) => number,
  inside: (x: number, y: number) => boolean,
): { c: T; probe: (r: number) => [number, number] } {
  const nearest = (x: number, y: number): T | undefined => {
    let best: T | undefined;
    let gap = Number.POSITIVE_INFINITY;
    for (const t of ps) {
      const g = Math.hypot(t.p[0] - x, t.p[1] - y);
      if (g < gap) [best, gap] = [t, g];
    }
    return best;
  };
  for (const c of [...ps].sort((a, b) => far(b) - far(a)))
    for (let k = 0; k < 8; k++) {
      const probe = (r: number): [number, number] => [
        c.p[0] + r * Math.cos((k * Math.PI) / 4),
        c.p[1] + r * Math.sin((k * Math.PI) / 4),
      ];
      if ([17, 19].every((r) => inside(...probe(r)) && nearest(...probe(r)) === c)) return { c, probe };
    }
  throw new Error("no point isolated by 19 px");
}
