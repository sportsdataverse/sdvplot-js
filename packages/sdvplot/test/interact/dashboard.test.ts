// @vitest-environment jsdom
// Phase 8 acceptance (plan Task 12, A11, A17, A23, A33): blazing-the-nets master's linked dashboard over Brooklyn's
// 2000 real 2025-26 shots, rebuilt from the library and linked through ONE store. Review Focus 6-10.
import { BASKETBALL_ZONE_LABELS, FRAMES } from "@sportsdataverse/sporty";
import * as d3 from "d3";
import { describe, expect, test, vi } from "vitest";
import { resetWarnings, setWarningHandler } from "../../src/index.js";
import { linkSelection, nearestHover } from "../../src/interact/index.js";
import { type SelectionStore, createSelection, toId } from "../../src/selection.js";
import { stubBBox, tipText } from "../plot/_pointer.js";
import { BKN, type BknShot } from "../shots/fixture.js";
import {
  D,
  type Dashboard,
  type Fig,
  HOOP,
  type Shape,
  by3,
  byFoot,
  dashboard,
  link,
  sides,
} from "./_dashboard.js";

stubBBox(); // jsdom has no text metrics: Plot measures a shown tip with getBBox

const px = (f: Fig, n: "x" | "y", v: number): number => Number(f.scale(n)?.apply(v));
const span = (f: Fig, n: "x" | "y"): [number, number] => {
  const r = Array.from(f.scale(n)?.range ?? [], Number);
  return [Math.min(...r), Math.max(...r)];
};
const cursorG = (f: Element): Element | null => f.querySelector("g.sdv-cursor");
const part = (f: Element, tag: string): Element => {
  const el = cursorG(f)?.querySelector(tag);
  if (!el) throw new Error(`no cursor ${tag}`);
  return el;
};
const at = (el: Element, a: string): number => Number(el.getAttribute(a));
const shown = (f: Element): boolean => cursorG(f)?.getAttribute("display") !== "none";
/** A pointer event in svg pixels (jsdom: d3.pointer and Plot's pointer read clientX/Y as svg px; no PointerEvent). */
const fire = (target: Element, type: string, clientX: number, clientY: number): void => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(e, "pointerType", { value: "mouse" });
  target.dispatchEvent(e);
};
/** The pointer at `ft` along an x-axis chart, halfway up its plot area. */
const overX = (f: Fig, ft: number): void => fire(f, "pointermove", px(f, "x", ft), span(f, "y")[0] + 10);
/** The pointer at `ft` up the side chart's y axis, beside its centre column. */
const overY = (f: Fig, ft: number): void => fire(f, "pointermove", span(f, "x")[0] + 10, px(f, "y", ft));

/**
 * A point that is still the nearest of `ps` 17 and 19 px out in one of 8 directions, both probes `inside`: there, only
 * a radius of 18 px tells the two probes apart. Outermost points first (`far`), where such a point is.
 */
function isolated<T extends { readonly p: readonly [number, number] }>(
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

function setup(shape: Shape): {
  d: Dashboard & { teardown: () => void };
  store: SelectionStore<BknShot>;
  updates: () => number;
} {
  const store = createSelection<BknShot>();
  const drawn = dashboard(shape);
  const d = { ...drawn, teardown: link(drawn, store) };
  const fn = vi.fn();
  store.subscribe(fn);
  return { d, store, updates: () => fn.mock.calls.length };
}
/** Every figure's cursor at `v`, each through its own scale (Review Focus 6). */
function expectCursorAt(d: Dashboard, v: number): void {
  const bin = Math.floor(v);
  for (const f of d.figures) expect(shown(f)).toBe(true);
  // share bars, linear x: the 1-ft band holding v, the plot area's full height
  const s = part(d.share, "rect");
  expect(at(s, "x")).toBeCloseTo(px(d.share, "x", bin));
  expect(at(s, "width")).toBeCloseTo(px(d.share, "x", bin + 1) - px(d.share, "x", bin));
  expect([at(s, "y"), at(s, "y") + at(s, "height")]).toEqual(span(d.share, "y"));
  // FG% bars, band x: the 3-ft band holding v
  const b = part(d.fg, "rect");
  const band = by3[Math.floor(v / 3)];
  expect(at(b, "x")).toBe(px(d.fg, "x", band?.distance ?? Number.NaN));
  expect(at(b, "width")).toBe(d.fg.scale("x")?.bandwidth);
  // side chart, linear y: the 1-ft band holding v, the plot area's full width
  const y = part(d.side, "rect");
  expect(at(y, "y")).toBeCloseTo(Math.min(px(d.side, "y", bin), px(d.side, "y", bin + 1)));
  expect(at(y, "height")).toBeCloseTo(Math.abs(px(d.side, "y", bin + 1) - px(d.side, "y", bin)));
  expect([at(y, "x"), at(y, "x") + at(y, "width")]).toEqual(span(d.side, "x"));
  // signature: a rule at v
  const rule = part(d.signature, "line");
  expect([at(rule, "x1"), at(rule, "x2")]).toEqual([px(d.signature, "x", v), px(d.signature, "x", v)]);
  // court: a ring around the hoop, its radii through the court's own x and y scales
  const ring = part(d.court, "ellipse");
  expect([at(ring, "cx"), at(ring, "cy")]).toEqual([px(d.court, "x", 0), px(d.court, "y", HOOP)]);
  expect(at(ring, "rx")).toBeCloseTo(Math.abs(px(d.court, "x", v) - px(d.court, "x", 0)));
  expect(at(ring, "ry")).toBeCloseTo(Math.abs(px(d.court, "y", HOOP + v) - px(d.court, "y", HOOP)));
}

test("fixture sanity: 1998 of the 2000 shots within 35 ft, each in one 1-ft, one 3-ft and one side bin (76 centre)", () => {
  expect(BKN).toHaveLength(2000);
  const sum = (ns: readonly number[]): number => ns.reduce((a, n) => a + n, 0);
  expect(BKN.filter((s) => s.shot_distance <= 35)).toHaveLength(1998);
  expect(sum(byFoot.map((b) => b.attempts))).toBe(1998);
  expect(sum(by3.map((b) => b.attempts))).toBe(1998);
  expect(sum(sides.map((b) => b.left.attempts + b.centre.attempts + b.right.attempts))).toBe(1998);
  // the 76 shots at x = 0 are the centre column (master's binLeftRight dropped them, src/utils/visuals/bin.ts:36-42)
  expect(BKN.filter((s) => s.x_legacy === 0)).toHaveLength(76);
  expect(sum(sides.map((b) => b.centre.attempts))).toBe(76);
});

describe.each<Shape>(["hex", "square"])("%s cells", (shape) => {
  // Plan Step 1 said "the bottom tenth". Measured: the hoop row is 0.757 of the court's height down, because sporty's
  // NBA "defense" range runs to y = -55 (an 8 ft apron behind the baseline at -47): the hoop is 13.25 of 55 ft up.
  test("hoop at the bottom: the frame runs from the apron to half court; a 0-ft shot maps centred, above the baseline; x < 0 draws left; the ring's centre is it", () => {
    const { d, store } = setup(shape);
    const rim = BKN.find((s) => s.shot_distance === 0 && s.x_legacy === 0 && s.y_legacy === 0);
    if (rim === undefined) throw new Error("no shot at the hoop");
    const f = FRAMES["nba-legacy-vertical"];
    const p = [
      px(d.court, "x", f.x({ x: rim.x_legacy }) ?? Number.NaN),
      px(d.court, "y", f.y({ y: rim.y_legacy }) ?? Number.NaN),
    ];
    const height = Number(d.court.getAttribute("height"));
    const [x0, x1] = span(d.court, "x");
    expect(p[0]).toBeCloseTo((x0 + x1) / 2);
    expect(Array.from(d.court.scale("y")?.domain ?? [], (v) => Math.round(Number(v)))).toEqual([-55, 0]); // the top is 1.8e-15 after the rotation
    expect(p[1]).toBeGreaterThan(0.75 * height); // so the hoop, 13.25 of 55 ft up, is in the bottom quarter
    expect(px(d.court, "x", f.x({ x: -229 }) ?? Number.NaN)).toBeLessThan(p[0] ?? Number.NaN); // main lib/data/court.ts:49
    expect(px(d.court, "y", -47)).toBeGreaterThan(p[1] ?? Number.NaN); // the baseline is below the hoop
    expect(px(d.court, "y", 0)).toBe(Math.min(...span(d.court, "y"))); // half court along the top edge
    store.set({ cursor: { field: D, value: 0 } });
    const ring = part(d.court, "ellipse");
    expect([at(ring, "cx"), at(ring, "cy")]).toEqual(p);
  });

  test("every bar of every figure sits inside its plot: no scale reads its domain in other units", () => {
    const { d } = setup(shape);
    const outside: string[] = [];
    const bars = d.figures.map((f) => {
      const [x0, x1] = span(f, "x");
      const [y0, y1] = span(f, "y");
      const rects = f.querySelectorAll('g[aria-label="bar"] rect, g[aria-label="rect"] rect');
      for (const r of rects) {
        const [x, y] = [at(r, "x"), at(r, "y")];
        if (!(x >= x0 - 1 && x + at(r, "width") <= x1 + 1 && y >= y0 - 1 && y + at(r, "height") <= y1 + 1))
          outside.push(`${f.getAttribute("aria-label") ?? ""} ${r.outerHTML}`);
      }
      return rects.length;
    });
    expect(outside).toEqual([]);
    expect(bars.slice(2).every((n) => n > 0)).toBe(true); // share, FG% and side draw bars
  });

  test("hovering 12.3 ft on the share bars puts ONE {distance, 12.5} in the store and every cursor at 12.5 (RF 6)", () => {
    const { d, store, updates } = setup(shape);
    overX(d.share, 12.3);
    expect(updates()).toBe(1);
    expect(store.getState().cursor).toEqual({ field: D, value: 12.5 });
    expectCursorAt(d, 12.5);
    expect(by3[4]?.distance).toBe(12); // the FG% band lit is the 12-14 ft band
  });

  test("a move inside the same bin is silent; crossing into 13 ft is one update; the band chart drives the rest (RF 8)", () => {
    const { d, store, updates } = setup(shape);
    overX(d.share, 12.3);
    overX(d.share, 12.9);
    expect(updates()).toBe(1);
    overX(d.share, 13.1);
    expect(updates()).toBe(2);
    expect(store.getState().cursor).toEqual({ field: D, value: 13.5 });
    expectCursorAt(d, 13.5);
    // the FG% chart's 9-11 ft band, anywhere across it: one value, its middle
    const nine = px(d.fg, "x", 9);
    const w = d.fg.scale("x")?.bandwidth ?? 0;
    fire(d.fg, "pointermove", nine + 2, span(d.fg, "y")[0] + 10);
    fire(d.fg, "pointermove", nine + w - 2, span(d.fg, "y")[0] + 10);
    expect(updates()).toBe(3);
    expect(store.getState().cursor).toEqual({ field: D, value: 10.5 });
    expectCursorAt(d, 10.5);
    // and the side chart drives them too
    overY(d.side, 20.4);
    expect(updates()).toBe(4);
    expectCursorAt(d, 20.5);
  });

  test("leaving any emitter hides all five cursors in ONE update (RF 8)", () => {
    const { d, store, updates } = setup(shape);
    const enter: [Fig, () => void][] = [
      [d.share, () => overX(d.share, 26.4)],
      [d.fg, () => overX(d.fg, 24)],
      [d.side, () => overY(d.side, 26.4)],
    ];
    for (const [f, over] of enter) {
      over();
      for (const g of d.figures) expect(shown(g)).toBe(true);
      const before = updates();
      fire(f, "pointerleave", 0, 0);
      expect(updates() - before).toBe(1);
      expect(store.getState().cursor).toBeNull();
      for (const g of d.figures) expect(shown(g)).toBe(false);
    }
  });

  test("a cursor move across the five figures adds or removes no element (RF 10)", () => {
    const { d } = setup(shape);
    overX(d.share, 12.3); // the first draw writes the readout's lines once
    const mo = new MutationObserver(() => {});
    for (const f of d.figures)
      mo.observe(f, { subtree: true, childList: true, attributes: true, characterData: true });
    overX(d.share, 13.1);
    overX(d.fg, 9);
    overY(d.side, 30.2);
    overX(d.share, 33.6); // the readout flips to the cursor's left
    fire(d.share, "pointerleave", 0, 0);
    overX(d.share, 2.2);
    const records = mo.takeRecords();
    mo.disconnect();
    expect(records.filter((r) => r.type === "childList")).toEqual([]);
    expect(records.filter((r) => r.type === "attributes").length).toBeGreaterThan(0);
  });

  test("the nearest cell within 18 px hovers its id and shows its tip; the cursor is untouched (RF 7, 9)", () => {
    const { d, store } = setup(shape);
    const f = FRAMES["nba-legacy-vertical"];
    // the drawn cells' centres in pixels (a cell centred off the plot is dropped, and Plot's pointer never sees it)
    const drawn = new Set(
      Array.from(d.court.querySelectorAll("[data-sdv-id]"), (e) => e.getAttribute("data-sdv-id")),
    );
    const centres = d.cells
      .filter((h) => drawn.has(`${h.x},${h.y}`))
      .map((h) => ({
        h,
        id: `${h.x},${h.y}`,
        p: [
          px(d.court, "x", f.x({ x: h.x }) ?? Number.NaN),
          px(d.court, "y", f.y({ y: h.y }) ?? Number.NaN),
        ] as const,
      }));
    const [x0, x1] = span(d.court, "x");
    const [y0, y1] = span(d.court, "y");
    const { c, probe } = isolated(
      centres,
      (t) => Math.hypot(t.h.x, t.h.y),
      (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
    );

    store.set({ cursor: { field: D, value: 12.5 } });
    const cursor = store.getState().cursor;
    for (const g of d.figures) expect(g.classList.contains("sdv-focus")).toBe(false); // a cursor never dims (RF 7)
    fire(d.court, "pointermove", ...probe(17));
    expect([...store.getState().hover]).toEqual([c.id]);
    expect(store.getState().cursor).toBe(cursor);
    expect(d.court.querySelector(".sdv-hl")?.getAttribute("data-sdv-id")).toBe(c.id); // the hovered cell lit
    expect(d.court.classList.contains("sdv-focus")).toBe(true);
    expect(tipText(d.court)).toContain(BASKETBALL_ZONE_LABELS[c.h.zone]); // main's four lines (A23)
    expect(tipText(d.court)).toContain(`${c.h.makes}/${c.h.attempts} FG`);
    expect(tipText(d.court)).toContain("League ");
    expect(tipText(d.court)).toContain(`${c.h.meanDistance.toFixed(1)} ft`);
    expectCursorAt(d, 12.5);
    fire(d.court, "pointermove", ...probe(19));
    expect([...store.getState().hover]).toEqual([]);
    expect(store.getState().cursor).toBe(cursor);
  });
});

// main's side chart (lib/charts/sideChart.ts:20-22, :66-75): left and right grow from a FIXED centre column's edges
test("the side chart: x < 0 shots grow left of a fixed centre column, x > 0 right; the axis reads attempts from its edges", () => {
  const { d } = setup("hex");
  const [left = [], centre = [], right = []] = Array.from(
    d.side.querySelectorAll('g[aria-label="rect"]'),
    (g) => Array.from(g.querySelectorAll("rect")),
  );
  const end = (r: Element): number => at(r, "x") + at(r, "width");
  const inner = [...new Set(left.map(end)), ...new Set(right.map((r) => at(r, "x")))];
  expect(inner).toHaveLength(2); // every row's left bar ends, and every right bar starts, at one x: the column's edges
  const [l = Number.NaN, r = Number.NaN] = inner;
  expect(r - l).toBeGreaterThan(0);
  for (const c of centre) expect([at(c, "x") >= l, end(c) <= r]).toEqual([true, true]);
  const k = px(d.side, "x", 1) - px(d.side, "x", 0); // px per attempt
  const row = (b: Element): number =>
    Math.floor(Number(d.side.scale("y")?.invert?.(at(b, "y") + at(b, "height") / 2)));
  const n = (ft: number, on: (x: number) => boolean): number =>
    BKN.filter((s) => s.shot_distance <= 35 && Math.floor(s.shot_distance) === ft && on(s.x_legacy)).length;
  for (const b of left) expect(at(b, "width")).toBeCloseTo(n(row(b), (x) => x < 0) * k);
  for (const b of right) expect(at(b, "width")).toBeCloseTo(n(row(b), (x) => x > 0) * k);
  expect(left.some((b) => n(row(b), (x) => x < 0) !== n(row(b), (x) => x > 0))).toBe(true); // so a swap shows
  const ticks = Array.from(d.side.querySelectorAll('g[aria-label="x-axis tick label"] text'));
  expect(ticks.length).toBeGreaterThan(2);
  for (const t of ticks) {
    const x = Number(/translate\(([-\d.]+)/.exec(t.getAttribute("transform") ?? "")?.[1]);
    expect(Number(t.textContent)).toBeCloseTo((Math.abs(x - (l + r) / 2) - (r - l) / 2) / k, 0);
  }
});

// Found in the browser (docs/docs/examples/shot-dashboard.mdx): the menu swapped the hovered hex court for the square
// one, the stale hex id stayed in the store, and the square court warned "none of the linked ids is drawn".
test("redrawing the court while a cell is hovered: the old link's teardown clears its hover; the cursor survives", () => {
  const { d, store } = setup("hex");
  const f = FRAMES["nba-legacy-vertical"];
  const cell = d.court.querySelector("path[data-sdv-id]");
  const h = d.cells.find((c) => `${c.x},${c.y}` === cell?.getAttribute("data-sdv-id"));
  if (h === undefined) throw new Error("no drawn cell");
  store.set({ cursor: { field: D, value: 26.5 } });
  const cursor = store.getState().cursor;
  fire(
    d.court,
    "pointermove",
    px(d.court, "x", f.x({ x: h.x }) ?? 0),
    px(d.court, "y", f.y({ y: h.y }) ?? 0),
  );
  expect([...store.getState().hover]).toEqual([`${h.x},${h.y}`]);
  const off = link(d, store); // a second link of the same figures: torn down below, it wrote nothing
  off();
  expect([...store.getState().hover]).toEqual([`${h.x},${h.y}`]); // another link's hover is not this one's to clear
  const warnings: string[] = [];
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
  try {
    d.teardown(); // the menu's swap: the hex court's links go, the square court's arrive
    expect([...store.getState().hover]).toEqual([]);
    expect(store.getState().cursor).toBe(cursor);
    const squares = dashboard("square");
    link(squares, store);
    expect(warnings).toEqual([]);
    expect(shown(squares.court)).toBe(true); // the new court rings the surviving cursor at once
    expect(squares.court.classList.contains("sdv-focus")).toBe(false);
  } finally {
    setWarningHandler(null);
  }
});

test("nearestHover on a d3 rendering of the same shots: within 18 px hovers and shows the tooltip; the cursor stays (RF 9)", () => {
  const { d, store } = setup("hex");
  const k = 0.8; // px per tenth of a foot, hoop at x_legacy = y_legacy = 0 (as the nearestHover gallery draws it)
  const at = (s: BknShot): [number, number] => [k * (s.x_legacy + 250), k * (420 - s.y_legacy)];
  const svg = d3
    .create("svg")
    .attr("viewBox", [0, 0, 500 * k, 470 * k])
    .node() as SVGSVGElement;
  d3.select(svg)
    .selectAll("circle")
    .data(BKN)
    .join("circle")
    .attr("data-sdv-id", (_, i) => toId(i))
    .attr("cx", (s) => at(s)[0])
    .attr("cy", (s) => at(s)[1])
    .attr("r", 2);
  linkSelection(store, { plot: svg, hover: false });
  nearestHover(svg, store, {
    points: BKN.map((s, i) => ({ x: at(s)[0], y: at(s)[1], id: toId(i) })),
    radius: 18,
    label: (id) => {
      const s = BKN[Number(id)];
      return s === undefined ? null : { lines: [`${s.shot_distance} ft`, s.shot_result] };
    },
  });
  const shots = BKN.map((s, i) => ({ s, id: toId(i), p: at(s) }));
  const { c, probe } = isolated(
    shots,
    (t) => Math.hypot(t.s.x_legacy, t.s.y_legacy),
    (x, y) => x >= 0 && x <= 500 * k && y >= 0 && y <= 470 * k,
  );
  store.set({ cursor: { field: D, value: 26.5 } });
  const cursor = store.getState().cursor;
  fire(svg, "pointermove", ...probe(17));
  expect([...store.getState().hover]).toEqual([c.id]);
  const tip = svg.querySelector("g.sdv-tip");
  expect(tip?.getAttribute("display")).not.toBe("none");
  expect(tip?.textContent).toContain(`${c.s.shot_distance} ft`);
  expect(store.getState().cursor).toBe(cursor);
  expect(svg.querySelector(".sdv-hl")?.getAttribute("data-sdv-id")).toBe(c.id);
  for (const f of d.figures) expect(shown(f)).toBe(true); // the dashboard's cursors stay where they were
  fire(svg, "pointermove", ...probe(19));
  expect([...store.getState().hover]).toEqual([]);
  expect(tip?.getAttribute("display")).toBe("none");
  expect(store.getState().cursor).toBe(cursor);
});
