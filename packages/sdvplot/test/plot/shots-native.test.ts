// @vitest-environment jsdom
// Phase 11 (J39, J40): the shot marks draw the CALLER's cells and areas, pass Plot's options through, and tip.
import * as Plot from "@observablehq/plot";
import { BASKETBALL_ZONE_LABELS, FRAMES, basketballZones } from "@sportsdataverse/sporty";
import { beforeAll, expect, test } from "vitest";
import { InputError } from "../../src/index.js";
import { shootingSignature, shotCells, shotZones, surface } from "../../src/plot/index.js";
import {
  type CellVsLeague,
  cellsVsLeague,
  fgPctByDistance,
  signaturePoints,
  sizeCells,
  statsByZone,
  vsLeague,
} from "../../src/shots/index.js";
import { BKN, LEAGUE } from "../shots/fixture.js";
import { pointAt, stubBBox, tipText } from "./_pointer.js";

beforeAll(stubBBox);
const px = (fig: ReturnType<typeof Plot.plot>, name: "x" | "y", v: number): number =>
  fig.scale(name)?.apply(v) as number;

test("shotCells tip: the rim hex shows 181 attempts, 81.2%, league 76.3% and the shrunk +4.3%", () => {
  const cells = cellsVsLeague(BKN, LEAGUE.hex15);
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({
    ...court.scales,
    width: 500,
    marks: [...court.marks, shotCells(cells, { r: sizeCells(cells, { radius: 15 }).r, tip: true })],
  });
  pointAt(fig, px(fig, "x", -41.75), px(fig, "y", 0)); // the hoop, nba-legacy frame
  expect(tipText(fig)).toMatch(
    /Attempts\s*181.*FG%\s*81\.2%.*League FG%\s*76\.3%.*vs league \(shrunk\)\s*\+4\.3%/,
  );
  expect((fig as unknown as { value: CellVsLeague }).value).toMatchObject({ x: 0, y: 0, attempts: 181 });
});

test("shotZones tip with statsByZone: the restricted area reads 358/527, 67.9%; each path is named", () => {
  const fig = Plot.plot({
    width: 500,
    height: 500,
    x: { domain: [-47, 0] },
    y: { domain: [-25, 25] },
    marks: shotZones(basketballZones("nba", { scale: 10 }), {
      fill: () => "#ddd",
      stats: statsByZone(BKN),
      tip: true,
    }),
  });
  pointAt(fig, px(fig, "x", -41.5), px(fig, "y", 0.3));
  expect(tipText(fig)).toMatch(/Zone\s*Restricted area.*Made\s*358\/527.*FG%\s*67\.9%/);
  expect(fig.querySelectorAll("g[aria-label=tip] text > tspan")).toHaveLength(3); // the anchor's x/y are not rows
  expect(fig.querySelector('path[data-sdv-id="paint"]')?.getAttribute("aria-label")).toBe("Paint (non-RA)");
});

test("a zone tip object's format merges per key: FG% as .0%, the anchor's x/y still hidden (3 rows, not 5)", () => {
  const fig = Plot.plot({
    width: 500,
    height: 500,
    x: { domain: [-47, 0] },
    y: { domain: [-25, 25] },
    marks: shotZones(basketballZones("nba", { scale: 10 }), {
      fill: () => "#ddd",
      stats: statsByZone(BKN),
      tip: { format: { fgPct: ".0%" } },
    }),
  });
  pointAt(fig, px(fig, "x", -41.5), px(fig, "y", 0.3));
  expect(tipText(fig)).toMatch(/Zone\s*Restricted area.*Made\s*358\/527.*FG%\s*68%/);
  expect(fig.querySelectorAll("g[aria-label=tip] text > tspan")).toHaveLength(3);
});

test("shootingSignature tip follows x: distance, FG%, league FG% and share at the pointer", () => {
  const pts = signaturePoints(vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot));
  const fig = Plot.plot({ width: 640, y: { domain: [0, 1] }, marks: shootingSignature(pts, { tip: true }) });
  pointAt(fig, px(fig, "x", 12.3), px(fig, "y", 0.5));
  expect(tipText(fig)).toMatch(
    /Distance\s*12\.25 ft.*FG%\s*46\.8%.*League FG%\s*46\.0%.*Share of shots\s*1\.2%/,
  );
});

test("the cells are the mark's data: mark-level fx facets two halves of the season's shots", () => {
  const half = (rows: typeof BKN, label: string) =>
    cellsVsLeague(rows, LEAGUE.hex15).map((c) => ({ ...c, half: label }));
  const both = [...half(BKN.slice(0, 1000), "first 1000"), ...half(BKN.slice(1000), "last 1000")];
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({
    ...court.scales,
    width: 900,
    marks: [...court.marks, shotCells(both, { r: 15, fx: "half" })],
  });
  expect(
    fig.querySelectorAll("g[aria-label='fx-axis tick label'] text, g[aria-label='fx-axis tick label']")
      .length,
  ).toBeGreaterThan(0);
  expect(fig.querySelectorAll("path[data-sdv-id]")).toHaveLength(both.length);
});

test("dropOutside: a tip never points at a dropped (off-frame) cell; Plot's own clip passes through", () => {
  // The real 2026 league hex15 index drawn as a player: 28 of its 397 centres lie past half court.
  const cells: CellVsLeague[] = LEAGUE.hex15.cells.map((c) => ({
    ...c,
    makes: Math.round((c.fgPct ?? 0) * c.attempts),
    meanDistance: Math.hypot(c.x, c.y) / 10,
    zone: "above_break_3",
    leagueFgPct: c.fgPct,
  }));
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({
    ...court.scales,
    width: 700,
    marks: [...court.marks, shotCells(cells, { r: 15, tip: true, clip: "frame" })],
  });
  // the pointer at each of the 28 dropped cells' centres (with the filter in render instead, the one nearest the
  // frame, (12.99, 427.5), was focused)
  const back = cells.filter((c) => c.y > 417.5);
  expect(back).toHaveLength(28);
  const focused = back.map((c) => {
    pointAt(fig, px(fig, "x", -47 + 5.25 + c.y / 10), px(fig, "y", c.x / 10));
    return (fig as unknown as { value: CellVsLeague | null }).value;
  });
  expect(focused.filter((v) => v !== null && v.y > 417.5)).toEqual([]);
  expect(fig.outerHTML).toMatch(/clip-path="url\(#plot-clip-\d+\)"/);
});

test("a caller's sort replaces the default fewest-attempts-first order", () => {
  const cells = cellsVsLeague(BKN, LEAGUE.hex15);
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({
    ...court.scales,
    width: 500,
    marks: [
      ...court.marks,
      shotCells(cells, { r: 15, sort: (a: CellVsLeague, b: CellVsLeague) => b.attempts - a.attempts }),
    ],
  });
  expect(fig.querySelectorAll("path[data-sdv-id]")[0]?.getAttribute("data-sdv-id")).toBe("0,0"); // busiest first
});

test("shotCells composes a caller's render (outermost), initializer (after the frame drop) and tip format", () => {
  const cells = cellsVsLeague(BKN, LEAGUE.hex15);
  const busy = cells.filter((c) => c.attempts >= 20).length;
  const seen: number[] = [];
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({
    ...court.scales,
    width: 500,
    marks: [
      ...court.marks,
      shotCells(cells, {
        r: 15,
        tip: { format: { diff: "+.2%" } }, // the caller's keys win; sdvplot's other formats stay
        render: (index, scales, values, dimensions, context, next) => {
          const g = next?.(index, scales, values, dimensions, context) ?? null;
          seen.push(g?.querySelectorAll("path[data-sdv-id]").length ?? -1); // sdvplot's stamps are inside
          return g;
        },
        initializer: (data, facets) => ({
          data,
          facets: facets.map((I) => I.filter((i) => (data[i] as CellVsLeague).attempts >= 20)),
        }),
      }),
    ],
  });
  expect(fig.querySelectorAll("path[data-sdv-id]")).toHaveLength(busy);
  expect(seen).toEqual([busy]);
  pointAt(fig, px(fig, "x", -41.75), px(fig, "y", 0));
  expect(tipText(fig)).toMatch(/vs league \(shrunk\)\s*\+4\.\d\d%/);
  expect(tipText(fig)).toMatch(/FG%\s*81\.2%.*League FG%\s*76\.3%/);
});

test("a row-making transform or initializer on a shot mark throws InputError (each path is stamped by input row)", () => {
  const cells = cellsVsLeague(BKN, LEAGUE.hex15);
  const court = surface("nba", { displayRange: "defense" });
  const draw = (m: Plot.Markish | Plot.Markish[]) => () =>
    Plot.plot({ ...court.scales, width: 500, marks: [...court.marks, m] });
  // Plot.hexbin keeps the cells as data but bins its channels; unguarded, cell i's path would show bin i
  expect(draw(shotCells(cells, Plot.hexbin({}, { r: 15, tip: true, binWidth: 60 })))).toThrow(InputError);
  const firstFive: Plot.TransformFunction = (data) => ({
    data: Array.from(data).slice(0, 5),
    facets: [[0, 1, 2, 3, 4]],
  });
  expect(draw(shotCells(cells, { r: 15, transform: firstFive }))).toThrow(InputError);
  const areas = basketballZones("nba", { scale: 10 });
  expect(draw(shotZones(areas, { fill: () => "#ddd", transform: firstFive }))).toThrow(InputError);
  const perBin: Plot.InitializerFunction = (data) => ({
    data,
    facets: [[0]],
    channels: { fill: { value: ["red"] } },
  });
  expect(draw(shotZones(areas, { fill: () => "#ddd", initializer: perBin }))).toThrow(InputError);
  // row-preserving still passes: a filter initializer on the zones
  const fig = draw(
    shotZones(areas, {
      fill: () => "#ddd",
      initializer: (data, facets) => ({ data, facets: facets.map((I) => I.filter((i) => i > 0)) }),
    }),
  )();
  expect(fig.querySelectorAll("path[data-sdv-id]")).toHaveLength(areas.length - 1);
});

test("shotZones labels are aria-hidden (the paths carry the names); a signature TipOptions format merges per key", () => {
  const z = statsByZone(BKN);
  const zones = Plot.plot({
    x: { domain: [-47, 0] },
    y: { domain: [-25, 25] },
    marks: shotZones(basketballZones("nba", { scale: 10 }), {
      fill: () => "#ddd",
      text: (k) => `${z[k].makes}/${z[k].attempts}`,
    }),
  });
  expect(zones.querySelector("g[aria-label=text]")?.getAttribute("aria-hidden")).toBe("true");
  const pts = signaturePoints(vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot));
  const fig = Plot.plot({
    width: 640,
    y: { domain: [0, 1] },
    marks: shootingSignature(pts, { tip: { format: { x: (d: number) => `${d} feet` } } }),
  });
  pointAt(fig, px(fig, "x", 12.3), px(fig, "y", 0.5));
  expect(tipText(fig)).toMatch(
    /Distance\s*12\.25 feet.*FG%\s*46\.8%.*League FG%\s*46\.0%.*Share of shots\s*1\.2%/,
  );
});

test("the tip is the last mark shotZones and shootingSignature return: the zone labels never paint over it", () => {
  const z = statsByZone(BKN);
  const label = (k: keyof typeof z) => `${z[k].makes}/${z[k].attempts}`;
  const zones = shotZones(basketballZones("nba", { scale: 10 }), {
    fill: () => "#ddd",
    text: label,
    stats: z,
    tip: true,
  });
  expect(zones).toHaveLength(3);
  expect(zones.at(-1)).toBeInstanceOf(Plot.Tip);
  const fig = Plot.plot({ x: { domain: [-47, 0] }, y: { domain: [-25, 25] }, marks: zones });
  expect(Array.from(fig.children, (c) => c.getAttribute("aria-label")).slice(-3)).toEqual([
    "geo",
    "text",
    "tip",
  ]);
  // [0] the paths and [1] the labels, with or without a tip
  const plain = shotZones(basketballZones("nba", { scale: 10 }), { fill: () => "#ddd", text: label });
  expect(plain).toHaveLength(2);
  const sig = shootingSignature(signaturePoints(vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot)), {
    tip: true,
  });
  expect(sig.at(-1)).toBeInstanceOf(Plot.Tip);
});

type Pt = readonly [number, number];
/** Winding number of `p` around a closed ring: an independent inside test (shotZones samples by even-odd). */
function winding([x, y]: Pt, ring: readonly Pt[]): number {
  let w = 0;
  ring.forEach(([ax, ay], i) => {
    const [bx, by] = ring[(i + 1) % ring.length] as Pt;
    const side = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
    if (ay <= y && by > y && side > 0) w++;
    else if (ay > y && by <= y && side < 0) w--;
  });
  return w;
}
/** Distance from `p` to the nearest edge of a closed ring. */
function edgeDistance([x, y]: Pt, ring: readonly Pt[]): number {
  return Math.min(
    ...ring.map(([ax, ay], i) => {
      const [bx, by] = ring[(i + 1) % ring.length] as Pt;
      const [dx, dy] = [bx - ax, by - ay];
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - ax - t * dx, y - ay - t * dy);
    }),
  );
}

test("zone tips follow the pointer: interior probes name their own zone (>= 99% per zone), all six reachable", () => {
  const areas = basketballZones("nba", { scale: 10 });
  const f = FRAMES["nba-legacy"];
  const rings = areas.map((a) =>
    a.points.map(([x, y]): Pt => [f.x({ x, y }) ?? Number.NaN, f.y({ x, y }) ?? Number.NaN]),
  );
  const fig = Plot.plot({
    width: 500,
    height: 500,
    x: { domain: [-47, 0] },
    y: { domain: [-25, 25] },
    marks: shotZones(areas, { fill: () => "#ddd", stats: statsByZone(BKN), tip: true }),
  });
  const names = areas.map((a) => BASKETBALL_ZONE_LABELS[a.zone]);
  const tally = names.map(() => ({ probes: 0, right: 0 }));
  const margin = 1.25 / 2; // half shotZones' sample step: the zones' 50 ft extent / 40
  // probes on a 0.73 ft grid offset from the samples', strictly inside a zone and `margin` from its every edge
  for (let x = -46.69; x < 0; x += 0.73) {
    for (let y = -24.83; y < 25; y += 0.73) {
      const k = rings.findIndex((r) => winding([x, y], r) !== 0);
      const ring = rings[k];
      if (ring === undefined || edgeDistance([x, y], ring) < margin) continue;
      pointAt(fig, px(fig, "x", x), px(fig, "y", y));
      const t = tally[k] as { probes: number; right: number };
      t.probes++;
      if (names.find((n) => tipText(fig).includes(n)) === names[k]) t.right++;
    }
  }
  const table = names.map((n, k) => `${n} ${tally[k]?.right}/${tally[k]?.probes}`).join("; ");
  for (const t of tally) {
    expect(t.probes, table).toBeGreaterThan(0);
    expect(t.right / t.probes, table).toBeGreaterThanOrEqual(0.99);
  }
});
