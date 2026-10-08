import * as Plot from "@observablehq/plot";
import { BKN_SHOTS_2026, NBA_LEAGUE_2026 } from "@sportsdataverse/examples/data";
import { createSelection } from "@sportsdataverse/sdvplot";
import { linkCursor, linkSelection } from "@sportsdataverse/sdvplot/interact";
import { shootingSignature, shotCells, shotZones, surface } from "@sportsdataverse/sdvplot/plot";
import {
  type CellVsLeague,
  cellsVsLeague,
  diffScale,
  fgPctByDistance,
  shrunkDiff,
  signaturePoints,
  sizeCells,
  statsByZone,
  vsLeague,
} from "@sportsdataverse/sdvplot/shots";
import { BASKETBALL_ZONE_LABELS, basketballZones } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "The shot kit, linked: click hexagons and zones, hover the nearest hexagon, one distance on court and curve",
  tags: [
    "plot",
    "shots",
    "linkSelection",
    "linkCursor",
    "createSelection",
    "shotCells",
    "shotZones",
    "shootingSignature",
    "cellsVsLeague",
    "statsByZone",
    "select",
    "linked",
    "nba",
  ],
} satisfies ExampleMeta;

// Brooklyn's first 2000 shots of 2025-26 against the 2025-26 league, hoop at the bottom. Click a hexagon or a zone to
// select it (or Tab to it and press Enter or Space); hover the court for the nearest hexagon within 18 px; hover the
// signature and the court rings that distance around the hoop.
const D = "shot_distance";
const frame = "nba-legacy-vertical";
const pct = (v: number | null): string => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);
const pts = (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}`;
// Hexagon ids ("x,y") and zone names are two id spaces, so each gets its own store: on one store a hovered hexagon
// would dim every zone.
const store = createSelection();
const zoneStore = createSelection();

// blazing-the-nets main's chart: 1.5 ft hexagons against the league in the same hexagon, its four tip lines
const cells = cellsVsLeague(BKN_SHOTS_2026, NBA_LEAGUE_2026.hex15);
const court = surface("nba", { displayRange: "defense", rotation: 90 });
const hexes = Plot.plot({
  ...court.scales,
  width: 500,
  marks: [
    ...court.marks,
    shotCells(cells, {
      r: sizeCells(cells, NBA_LEAGUE_2026.hex15).r,
      frame,
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
linkSelection(store, { plot: hexes, select: "toggle", hover: { id: (h: CellVsLeague) => `${h.x},${h.y}` } });
linkCursor(hexes, store, {
  field: D,
  shape: { axis: "ring", x: hexes.scale("x")!, y: hexes.scale("y")!, center: [0, -41.75] }, // the vertical frame's hoop
});

// The zones, each filled by its FG% against the league's in that zone and labelled makes/attempts
const player = statsByZone(BKN_SHOTS_2026);
const colour = diffScale();
const zones = Plot.plot({
  ...court.scales,
  width: 500,
  marks: [
    ...court.marks,
    ...shotZones(basketballZones("nba", { scale: 10 }), {
      fill: (z) => {
        const rate = NBA_LEAGUE_2026.hex15.zones[z].fgPct;
        return colour(rate === null ? null : shrunkDiff(player[z].makes, player[z].attempts, rate));
      },
      text: (z) => `${player[z].makes}/${player[z].attempts}`,
      frame,
    }),
  ],
});
linkSelection(zoneStore, { plot: zones, select: "toggle" });

// The shooting signature writes the distance under the pointer, one value per foot
const signature = Plot.plot({
  width: 500,
  height: 220,
  x: { label: "Shot distance (ft)" },
  y: { domain: [0, 1], label: "FG%", tickFormat: "%" },
  marks: shootingSignature(
    signaturePoints(vsLeague(fgPctByDistance(BKN_SHOTS_2026), NBA_LEAGUE_2026.byFoot)),
    { curve: "basis" },
  ),
});
linkCursor(signature, store, {
  field: D,
  shape: { axis: "x", scale: signature.scale("x")! },
  snap: (feet) => Math.floor(feet) + 0.5,
});

store.set({ cursor: { field: D, value: 26.5 } }); // just behind the arc: Brooklyn's busiest foot
const root = document.createElement("div");
root.style.cssText = "display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start";
root.append(hexes, zones, signature);
export default root;
