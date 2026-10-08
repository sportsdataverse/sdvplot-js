// @vitest-environment jsdom
// Phase 10 Task 10 (J36(b); S11, S22): the shot kit (court, zones, signature) linked through sdvplot/interact over
// Brooklyn's 2000 real 2025-26 shots against the 2025-26 league. No new primitive: Phase 8's linkSelection (toggle,
// Plot-tip hover), linkCursor and highlight on the marks' own `data-sdv-id` stamps.
import { BASKETBALL_ZONES, FRAMES } from "@sportsdataverse/sporty";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { resetWarnings, setWarningHandler } from "../../src/index.js";
import { highlight } from "../../src/interact/index.js";
import { createSelection } from "../../src/selection.js";
import { leagueIndex, statsByZone } from "../../src/shots/index.js";
import { stubBBox } from "../plot/_pointer.js";
import { BKN, type BknShot } from "../shots/fixture.js";
import { D, HOOP, type Kit, at, fire, isolated, kit, linkKit, part, px, shown, span } from "./_dashboard.js";

stubBBox(); // jsdom has no text metrics: Plot measures a shown tip with getBBox

const f = FRAMES["nba-legacy-vertical"];
let warnings: string[] = [];
beforeEach(() => {
  warnings = [];
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
});
afterEach(() => setWarningHandler(null));

function setup(o?: Parameters<typeof kit>[0]) {
  const store = createSelection<BknShot>();
  const zones = createSelection<BknShot>();
  const k = kit(o);
  linkKit(k, store, zones);
  return { k, store, zones };
}
interface Centre {
  readonly id: string;
  readonly p: readonly [number, number];
}
/** Every drawn cell (a `[data-sdv-id]` path; Plot's pointer sees no other) with its legacy centre in court pixels. */
const drawnCentres = (k: Kit): Centre[] => {
  const drawn = new Set(
    Array.from(k.court.querySelectorAll("[data-sdv-id]"), (e) => e.getAttribute("data-sdv-id")),
  );
  return k.cells
    .filter((h) => drawn.has(`${h.x},${h.y}`))
    .map((h) => ({
      id: `${h.x},${h.y}`,
      p: [
        px(k.court, "x", f.x({ x: h.x }) ?? Number.NaN),
        px(k.court, "y", f.y({ y: h.y }) ?? Number.NaN),
      ] as const,
    }));
};
const nearest = (cs: readonly Centre[], [x, y]: readonly [number, number]): Centre | undefined =>
  cs.reduce<Centre | undefined>(
    (b, c) =>
      b === undefined || Math.hypot(c.p[0] - x, c.p[1] - y) < Math.hypot(b.p[0] - x, b.p[1] - y) ? c : b,
    undefined,
  );
/** `r` px from `c` at `deg` degrees (svg: y grows down). */
const off = (c: Centre, r: number, deg: number): [number, number] => [
  c.p[0] + r * Math.cos((deg * Math.PI) / 180),
  c.p[1] + r * Math.sin((deg * Math.PI) / 180),
];
/** The lines of the court's shown tip: Plot draws `title` one tspan per line, each opening with a zero-width space. */
const tipLines = (root: Element): string[] =>
  Array.from(root.querySelectorAll("g[aria-label=tip] tspan"), (t) =>
    (t.textContent ?? "").replace(/^\u200b/, ""),
  );
const cell = (k: Kit, id: string): Element => {
  const el = k.court.querySelector(`path[data-sdv-id="${id}"]`);
  if (!el) throw new Error(`cell ${id} is not drawn`);
  return el;
};
const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
};
const press = (el: Element, key: string): KeyboardEvent => {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
};

/** A click, Enter and Space each toggle `id`, and its `aria-checked` follows the store. */
function expectToggles(k: Kit, store: ReturnType<typeof setup>["store"], id: string): void {
  const el = cell(k, id);
  const drawn = k.court.querySelectorAll("path[data-sdv-id]");
  expect(k.court.querySelectorAll('[role="checkbox"][tabindex="0"]')).toHaveLength(drawn.length); // every cell
  expect(el.getAttribute("aria-checked")).toBe("false");
  click(el);
  expect([...store.getState().selected]).toEqual([id]);
  expect([el.getAttribute("aria-checked"), el.classList.contains("sdv-hl")]).toEqual(["true", true]);
  expect(k.court.classList.contains("sdv-focus")).toBe(true); // the other cells dim
  click(el);
  expect([...store.getState().selected]).toEqual([]);
  expect([el.getAttribute("aria-checked"), k.court.classList.contains("sdv-focus")]).toEqual([
    "false",
    false,
  ]);
  expect(press(el, "Enter").defaultPrevented).toBe(true);
  expect([...store.getState().selected]).toEqual([id]);
  expect(el.getAttribute("aria-checked")).toBe("true");
  expect(press(el, " ").defaultPrevented).toBe(true); // Space would scroll the page
  expect([...store.getState().selected]).toEqual([]);
  expect(press(el, "a").defaultPrevented).toBe(false);
  expect([...store.getState().selected]).toEqual([]);
  store.set({ selected: [id] }); // and the store drives it: another writer's selection
  expect(el.getAttribute("aria-checked")).toBe("true");
}

test("click-to-select a hex (J36(b)): a click on the rim hex puts '0,0' in selected and a second removes it; Enter and Space toggle; aria-checked follows", () => {
  const { k, store } = setup();
  expect(k.court.querySelectorAll("path[data-sdv-id]")).toHaveLength(211); // main's 211 hexagons, all on the court
  const rim = k.cells.find((h) => h.x === 0 && h.y === 0);
  expect([rim?.makes, rim?.attempts]).toEqual([147, 181]);
  expectToggles(k, store, "0,0");
  // a click also pins Plot's tip (pointerdown); a pinned tip must not take the clicks meant for the cells under it
  const [x, y] = drawnCentres(k).find((c) => c.id === "0,0")?.p ?? [0, 0];
  fire(k.court, "pointermove", x + 3, y);
  fire(k.court, "pointerdown", x + 3, y);
  expect(k.court.querySelector("g[aria-label=tip]")?.getAttribute("pointer-events")).toBe("none");
  expect(warnings).toEqual([]);
});

test("zones select by name: a click on the paint selects 'paint'; every zone id is drawn; hex ids and zone names keep to their own stores", () => {
  const { k, store, zones } = setup();
  const paint = k.zones.querySelector('path[data-sdv-id="paint"]');
  if (!paint) throw new Error("no paint");
  // Each zone's label sits in it, where a reader clicks or hovers it (Chromium: elementFromPoint at the paint's label
  // is the <text>), so every label lets the pointer through to its zone.
  const labels = Array.from(k.zones.querySelectorAll("g[aria-label=text] text"));
  expect(labels.map((t) => t.textContent)).toContain(
    `${statsByZone(BKN).paint.makes}/${statsByZone(BKN).paint.attempts}`,
  );
  for (const t of labels) expect(t.closest("[pointer-events]")?.getAttribute("pointer-events")).toBe("none");
  click(paint);
  expect([...zones.getState().selected]).toEqual(["paint"]);
  expect([paint.getAttribute("aria-checked"), paint.classList.contains("sdv-hl")]).toEqual(["true", true]);
  expect(k.zones.querySelectorAll(".sdv-hl")).toHaveLength(1); // the paint, and no other zone
  click(cell(k, "0,0"));
  expect([...store.getState().selected]).toEqual(["0,0"]);
  // one store per id space: a cell selected dims no zone, a zone selected dims no cell, and nothing warns
  expect(Array.from(k.zones.querySelectorAll(".sdv-hl"), (e) => e.getAttribute("data-sdv-id"))).toEqual([
    "paint",
  ]);
  expect(Array.from(k.court.querySelectorAll(".sdv-hl"), (e) => e.getAttribute("data-sdv-id"))).toEqual([
    "0,0",
  ]);
  expect(warnings).toEqual([]);
  expect(highlight(k.zones, new Set(["paint"]))).toEqual([]);
  expect(highlight(k.zones, new Set(BASKETBALL_ZONES))).toEqual([]); // all six drawn
});

// main lib/charts/hexShotChart.ts:164-194: the nearest hex centre within 18 px, and its four lines (:183-189, with
// lib/format.ts:4-8). Measured: the court is 8.317 px a foot, the rim hex's five drawn neighbours sit 21.6 px away,
// so 10 px from its centre the rim hex is the nearest in every direction.
test("nearest hex within 18 px (S22: shotCells tip maxRadius 18 + linkSelection hover): the rim hex hovers at 10 px with main's four lines and clears at 19 px", () => {
  const { k, store } = setup();
  const cs = drawnCentres(k);
  const rim = cs.find((c) => c.id === "0,0");
  if (!rim) throw new Error("the rim hex is not drawn");
  for (let deg = 0; deg < 360; deg += 45) {
    fire(k.court, "pointermove", ...off(rim, 10, deg));
    expect([...store.getState().hover]).toEqual(["0,0"]);
    expect(tipLines(k.court)).toEqual([
      "Restricted area",
      "147/181 FG, 81.2%",
      "League 76.3% (+4.9)",
      "0.6 ft",
    ]);
    expect(k.court.querySelector(".sdv-hl")?.getAttribute("data-sdv-id")).toBe("0,0");
  }
  // 19 px out where the rim hex is still the nearest: behind it, where no shot made a hex
  const [x0, x1] = span(k.court, "x");
  const [y0, y1] = span(k.court, "y");
  const deg = Array.from({ length: 360 }, (_, d) => d).find((d) =>
    [17, 19].every((r) => {
      const [x, y] = off(rim, r, d);
      return x >= x0 && x <= x1 && y >= y0 && y <= y1 && nearest(cs, [x, y]) === rim;
    }),
  );
  if (deg === undefined) throw new Error("no direction leaves the rim hex the nearest at 19 px");
  fire(k.court, "pointermove", ...off(rim, 17, deg));
  expect([...store.getState().hover]).toEqual(["0,0"]);
  fire(k.court, "pointermove", ...off(rim, 19, deg));
  expect([...store.getState().hover]).toEqual([]);
  expect(tipLines(k.court)).toEqual([]);
  expect(k.court.classList.contains("sdv-focus")).toBe(false);
  expect(warnings).toEqual([]);
});

test("one cursor, the ring and the rule (master ShotchartCursor.js:11-18, ShootingSignature/Cursor.js:6-21): one update, attributes only", () => {
  const { k, store } = setup();
  const updates = vi.fn();
  store.subscribe(updates);
  const mo = new MutationObserver(() => {});
  for (const g of k.figures) mo.observe(g, { subtree: true, childList: true, attributes: true });
  const expectAt = (v: number): void => {
    const ring = part(k.court, "ellipse");
    expect([at(ring, "cx"), at(ring, "cy")]).toEqual([px(k.court, "x", 0), px(k.court, "y", HOOP)]);
    expect(at(ring, "rx")).toBeCloseTo(Math.abs(px(k.court, "x", v) - px(k.court, "x", 0)));
    expect(at(ring, "ry")).toBeCloseTo(Math.abs(px(k.court, "y", HOOP + v) - px(k.court, "y", HOOP)));
    const rule = part(k.signature, "line");
    expect([at(rule, "x1"), at(rule, "x2")]).toEqual([px(k.signature, "x", v), px(k.signature, "x", v)]);
    expect([shown(k.court), shown(k.signature)]).toEqual([true, true]);
  };
  store.set({ cursor: { field: D, value: 12.5 } });
  expect(updates).toHaveBeenCalledTimes(1);
  expectAt(12.5);
  expect(at(part(k.court, "ellipse"), "rx")).toBeCloseTo(12.5 * 8.316666666666663); // 12.5 ft at 8.317 px a foot
  store.set({ cursor: { field: D, value: 20.5 } });
  expect(updates).toHaveBeenCalledTimes(2);
  expectAt(20.5);
  // the signature emits: a pointer 26.3 ft along it is ONE update, snapped to its 1 ft bin, and the ring follows
  fire(k.signature, "pointermove", px(k.signature, "x", 26.3), span(k.signature, "y")[0] + 10);
  expect(updates).toHaveBeenCalledTimes(3);
  expect(store.getState().cursor).toEqual({ field: D, value: 26.5 });
  expectAt(26.5);
  const records = mo.takeRecords();
  mo.disconnect();
  expect(records.filter((r) => r.type === "childList")).toEqual([]); // no element added or removed
  expect(records.filter((r) => r.type === "attributes").length).toBeGreaterThan(0);
  expect(k.zones.querySelector("g.sdv-cursor")).toBeNull(); // the zones follow no distance
  expect(k.court.classList.contains("sdv-focus")).toBe(false); // a cursor dims nothing
});

// S11 (J38): squares link exactly like hexagons. The index is S5's real-shot one (no square league fixture at side
// 15). Measured: the rim square's four neighbours sit 12.47 px away (1.5 ft at 8.317 px a foot; S11 said about 15).
test("square cells link like hex cells (J38 S11): '0,0' toggles by click, Enter and Space; the nearest square within 18 px hovers; every square id is drawn", () => {
  const sq = leagueIndex(BKN, { shape: "square", side: 15 });
  const { k, store } = setup({ index: sq, shape: "square" });
  const ids = Array.from(k.court.querySelectorAll("path[data-sdv-id]"), (e) => e.getAttribute("data-sdv-id"));
  expect(new Set(ids)).toEqual(new Set(k.cells.map((h) => `${h.x},${h.y}`))); // every square, its "x,y"
  expect(ids).toHaveLength(395);
  const rim = k.cells.find((h) => h.x === 0 && h.y === 0);
  expect([rim?.makes, rim?.attempts]).toEqual([91, 115]);
  expectToggles(k, store, "0,0");
  store.set({ selected: [] });
  const cs = drawnCentres(k);
  const centre = cs.find((c) => c.id === "0,0");
  if (!centre) throw new Error("the rim square is not drawn");
  for (let deg = 0; deg < 360; deg += 45) {
    fire(k.court, "pointermove", ...off(centre, 5, deg));
    expect([...store.getState().hover]).toEqual(["0,0"]);
    expect(tipLines(k.court)).toEqual([
      "Restricted area",
      "91/115 FG, 79.1%",
      "League 79.1% (+0.0)",
      "0.4 ft",
    ]);
  }
  // a square whose nearest-ness survives 19 px: 17 px hovers it, 19 px (no square centre within 18 px) clears
  const [x0, x1] = span(k.court, "x");
  const [y0, y1] = span(k.court, "y");
  const { c, probe } = isolated(
    cs,
    (t) => Math.hypot(t.p[0] - centre.p[0], t.p[1] - centre.p[1]),
    (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
  );
  fire(k.court, "pointermove", ...probe(17));
  expect([...store.getState().hover]).toEqual([c.id]);
  fire(k.court, "pointermove", ...probe(19));
  expect([...store.getState().hover]).toEqual([]);
  expect(highlight(k.court, new Set(["0,0"]))).toEqual([]);
  expect(warnings).toEqual([]);
});
