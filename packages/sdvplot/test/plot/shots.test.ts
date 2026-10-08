// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { basketballZones } from "@sportsdataverse/sporty";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { highlight } from "../../src/interact/index.js";
import { shootingSignature, shotCells, shotZones, surface } from "../../src/plot/index.js";
import {
  type CellVsLeague,
  cellsVsLeague,
  diffScale,
  fgPctByDistance,
  leagueIndex,
  shrunkDiff,
  signaturePoints,
  sizeCells,
  statsByZone,
  vsLeague,
} from "../../src/shots/index.js";
import { BKN, LEAGUE } from "../shots/fixture.js";

// Plot reports a warning on the console and as a ⚠️ badge on the figure; the docs gate rejects both.
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn");
});
afterEach(() => {
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

/** The paths of the last geo mark on a figure (the court's own geo marks come first). */
const lastGeoPaths = (fig: Element): Element[] => {
  const geos = fig.querySelectorAll("g[aria-label=geo]");
  return [...(geos[geos.length - 1]?.querySelectorAll("path") ?? [])];
};

test("shotCells: one data-space hexagon per visible hex, on the court, id-stamped, coloured by shrunk diff", () => {
  const hexes = cellsVsLeague(BKN, LEAGUE.hex15);
  const { r } = sizeCells(hexes, { radius: 15 });
  const court = surface("nba", { displayRange: "defense" });
  const fig = Plot.plot({ ...court.scales, width: 500, marks: [...court.marks, shotCells(hexes, { r })] });
  const paths = lastGeoPaths(fig);
  expect(paths).toHaveLength(211); // every hex has at least one attempt, so none is hidden
  const rim = fig.querySelector('path[data-sdv-id="0,0"]'); // 181 attempts, the biggest, drawn last
  expect(rim).toBe(paths[paths.length - 1]);
  const h = hexes.find((x) => x.x === 0 && x.y === 0);
  expect(h?.attempts).toBe(181);
  expect(rim?.getAttribute("fill")).toBe(
    diffScale()(shrunkDiff(h?.makes ?? 0, h?.attempts ?? 0, h?.leagueFgPct ?? 0)),
  );
});

test("shotCells honours the frame: nba-legacy-vertical puts the rim hex at the bottom centre", () => {
  const hexes = cellsVsLeague(BKN, LEAGUE.hex15);
  const court = surface("nba", { displayRange: "defense", rotation: 90 });
  const fig = Plot.plot({
    ...court.scales,
    width: 500,
    marks: [shotCells(hexes, { r: 15, frame: "nba-legacy-vertical" })],
  });
  const x = fig.scale("x");
  const y = fig.scale("y");
  const [r0, r1] = [...(x?.range ?? [])] as number[];
  expect(x?.apply(0)).toBeCloseTo(((r0 ?? 0) + (r1 ?? 0)) / 2, 6);
  expect(y?.apply(-41.75)).toBeGreaterThan(y?.apply(-20) ?? 0); // y grows down in pixels: the hoop is lower
  // The rim hex's own outline sits around that bottom-centre hoop: its six vertices average to (x(0), y(-41.75)).
  const d = fig.querySelector('path[data-sdv-id="0,0"]')?.getAttribute("d") ?? "";
  const pts = [...d.matchAll(/[ML]([-\d.e]+),([-\d.e]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  expect(pts).toHaveLength(6);
  const mean = (k: 0 | 1) => pts.reduce((s, p) => s + (p[k] ?? 0), 0) / pts.length;
  expect(mean(0)).toBeCloseTo(x?.apply(0) ?? Number.NaN, 1);
  expect(mean(1)).toBeCloseTo(y?.apply(-41.75) ?? Number.NaN, 1);
});

test("shotZones: six zone areas with zone ids and six haloed labels", () => {
  const z = statsByZone(BKN);
  const fig = Plot.plot({
    x: { domain: [-47, 0] },
    y: { domain: [-25, 25] },
    marks: shotZones(basketballZones("nba", { scale: 10 }), {
      fill: () => "#dddddd",
      text: (k) => `${z[k].makes}/${z[k].attempts}`,
    }),
  });
  expect([...fig.querySelectorAll("path[data-sdv-id]")].map((p) => p.getAttribute("data-sdv-id"))).toEqual([
    "restricted_area",
    "paint",
    "mid_range",
    "corner_3_left",
    "corner_3_right",
    "above_break_3",
  ]);
  const labels = [...fig.querySelectorAll("g[aria-label=text] text")];
  expect(labels).toHaveLength(6);
  expect(labels.map((t) => t.textContent)).toContain("358/527");
  const g = fig.querySelector("g[aria-label=text]");
  expect(g?.getAttribute("paint-order")).toBe("stroke");
  expect(g?.getAttribute("stroke-width")).toBe("3");
  expect(g?.getAttribute("pointer-events")).toBe("none"); // a label never takes the click or hover meant for its zone
  // the corner strips' labels run vertically
  expect(labels.filter((t) => /rotate\(-90\)/.test(t.getAttribute("transform") ?? ""))).toHaveLength(2);
});

/** What highlight's appended dimming rule matches: its own selector, run against the figure (as highlight.test does). */
const dimmed = (root: Element): Element[] => {
  const css = root.querySelector("style[data-sdv-interact]")?.textContent ?? "";
  return [...root.querySelectorAll(css.slice(0, css.indexOf("{")))];
};

test("with Plot's href, shotCells and shotZones stamp the <a> around each path, as linkIds does, and highlight dims it (A27, A38)", () => {
  const hexes = cellsVsLeague(BKN, LEAGUE.hex15);
  const { r } = sizeCells(hexes, { radius: 15 });
  const court = surface("nba", { displayRange: "defense" });
  const cells = Plot.plot({
    ...court.scales,
    width: 500,
    marks: [...court.marks, shotCells(hexes, { r, href: (h: CellVsLeague) => `#hex-${h.x},${h.y}` })],
  });
  expect(cells.querySelectorAll("a[data-sdv-id]")).toHaveLength(211);
  expect(cells.querySelectorAll("path[data-sdv-id]")).toHaveLength(0); // on the <a>, never also on its path
  const rim = cells.querySelector('a[data-sdv-id="0,0"]'); // 181 attempts
  expect(rim?.getAttribute("href")).toBe("#hex-0,0");
  expect(highlight(cells, new Set(["0,0"]))).toEqual([]); // the rim's id is found
  expect(dimmed(cells)).toHaveLength(210);
  expect(dimmed(cells)).not.toContain(rim);

  const zones = Plot.plot({
    x: { domain: [-47, 0] },
    y: { domain: [-25, 25] },
    marks: shotZones(basketballZones("nba", { scale: 10 }), {
      fill: () => "#dddddd",
      href: (a: { zone: string }) => `#${a.zone}`,
    }),
  });
  expect([...zones.querySelectorAll("a[data-sdv-id]")].map((a) => a.getAttribute("data-sdv-id"))).toEqual([
    "restricted_area",
    "paint",
    "mid_range",
    "corner_3_left",
    "corner_3_right",
    "above_break_3",
  ]);
  expect(zones.querySelectorAll("path[data-sdv-id]")).toHaveLength(0);
  highlight(zones, new Set(["paint"]));
  expect(dimmed(zones).map((e) => e.getAttribute("data-sdv-id"))).toEqual([
    "restricted_area",
    "mid_range",
    "corner_3_left",
    "corner_3_right",
    "above_break_3",
  ]);
});

test("shootingSignature: content-hash gradient ids, equal for equal input, distinct otherwise; 61 stops", () => {
  const pts = signaturePoints(vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot));
  const a = Plot.plot({ y: { domain: [0, 1] }, marks: shootingSignature(pts) });
  const b = Plot.plot({ y: { domain: [0, 1] }, marks: shootingSignature(pts) });
  const c = Plot.plot({
    y: { domain: [0, 1] },
    marks: shootingSignature(pts, { fill: diffScale({ theme: "dark" }) }),
  });
  const id = (f: Element) => f.querySelector("linearGradient")?.getAttribute("id");
  expect(id(a)).toMatch(/^sdv-signature-[0-9a-z]+$/);
  expect(id(a)).toBe(id(b));
  expect(id(a)).not.toBe(id(c));
  expect(a.querySelectorAll("linearGradient stop")).toHaveLength(61); // 121 drawn samples, every other one
  expect(a.querySelector(`[fill="url(#${id(a)})"]`)).not.toBeNull(); // Plot puts a constant fill on the mark's <g>
});

test("shotCells shape 'square' (J38): four-corner data-space squares, id-stamped and coloured like hexes", () => {
  const index = leagueIndex(BKN, { shape: "square", side: 15 });
  const cells = cellsVsLeague(BKN, index);
  const court = surface("nba", { displayRange: "defense" });
  const draw = (shape: "hex" | "square") =>
    Plot.plot({
      ...court.scales,
      width: 500,
      marks: [...court.marks, shotCells(cells, { r: sizeCells(cells, index).r, shape })],
    });
  const fig = draw("square");
  const paths = lastGeoPaths(fig);
  expect(paths).toHaveLength(395);
  const corners = (p: Element) => p.getAttribute("d")?.match(/[ML]/g)?.length;
  expect(new Set(paths.map(corners))).toEqual(new Set([4]));
  const hexPaths = lastGeoPaths(draw("hex"));
  expect(new Set(hexPaths.map(corners))).toEqual(new Set([6])); // same cells, same order, only the outline differs
  expect(hexPaths.map((p) => p.getAttribute("data-sdv-id"))).toEqual(
    paths.map((p) => p.getAttribute("data-sdv-id")),
  );
  const rim = fig.querySelector('path[data-sdv-id="0,0"]'); // 115 attempts, the busiest square, drawn last
  expect(rim).toBe(paths[paths.length - 1]);
  const h = cells.find((c) => c.x === 0 && c.y === 0);
  expect(h?.attempts).toBe(115);
  expect(rim?.getAttribute("fill")).toBe(
    diffScale()(shrunkDiff(h?.makes ?? 0, h?.attempts ?? 0, h?.leagueFgPct ?? 0)),
  );
});

test("shootingSignature: one data set at two widths keeps two gradients, each spanning its own x range", () => {
  // The gradient is in user space (pixels), so the same stops at another width are another gradient. On one page a
  // `url(#id)` resolves to the FIRST element with that id, as `getElementById` does here.
  const pts = signaturePoints(vsLeague(fgPctByDistance(BKN), LEAGUE.byFoot));
  const maxFt = pts.at(-1)?.distance ?? Number.NaN;
  const figs = [700, 400].map((width) =>
    Plot.plot({ width, y: { domain: [0, 1] }, marks: shootingSignature(pts) }),
  );
  document.body.append(...figs);
  try {
    const ids = figs.map((f) => f.querySelector("linearGradient")?.getAttribute("id"));
    expect(new Set(ids).size).toBe(2);
    for (const f of figs) {
      const url = f.querySelector("g[aria-label=area]")?.getAttribute("fill") ?? ""; // the ribbon's url(#id)
      const grad = document.getElementById(url.slice("url(#".length, -1));
      expect(f.contains(grad)).toBe(true);
      const x = f.scale("x");
      expect(Number(grad?.getAttribute("x1"))).toBeCloseTo(x?.apply(0) ?? Number.NaN, 9);
      expect(Number(grad?.getAttribute("x2"))).toBeCloseTo(x?.apply(maxFt) ?? Number.NaN, 9);
    }
  } finally {
    for (const f of figs) f.remove();
  }
});

test("shotCells drops cells centred off the plot's frame (main's `h.y <= v.top`); dropOutside: false draws them all", () => {
  // The REAL 2026 league hex15 index drawn as a player: 28 of its 397 centres lie past the half-court line
  // (legacy y > 417.5, 41.75 ft from the hoop), off the defensive half court's frame.
  const cells: CellVsLeague[] = LEAGUE.hex15.cells.map((c) => ({
    ...c,
    makes: Math.round((c.fgPct ?? 0) * c.attempts),
    meanDistance: Math.hypot(c.x, c.y) / 10, // not read by the mark
    zone: "above_break_3", // not read by the mark
    leagueFgPct: c.fgPct,
  }));
  const back = new Set(cells.filter((c) => c.y > 417.5).map((c) => `${c.x},${c.y}`));
  expect(cells).toHaveLength(397);
  expect(back.size).toBe(28);
  const ids = (vertical: boolean, dropOutside?: boolean) => {
    const court = surface("nba", { displayRange: "defense", ...(vertical ? { rotation: 90 } : {}) });
    const frame = vertical ? "nba-legacy-vertical" : "nba-legacy";
    const mark = shotCells(
      cells,
      dropOutside === undefined ? { r: 15, frame } : { r: 15, frame, dropOutside },
    );
    const fig = Plot.plot({ ...court.scales, width: 700, marks: [...court.marks, mark] });
    return lastGeoPaths(fig).map((p) => p.getAttribute("data-sdv-id") ?? "");
  };
  for (const vertical of [false, true]) {
    const drawn = ids(vertical);
    expect(drawn).toHaveLength(397 - 28);
    expect(drawn.filter((id) => back.has(id))).toEqual([]);
    expect(ids(vertical, true)).toEqual(drawn);
    expect(ids(vertical, false)).toHaveLength(397);
  }
});
