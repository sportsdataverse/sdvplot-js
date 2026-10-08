// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import * as d3 from "d3";
import { expect, test, vi } from "vitest";
import { InputError } from "../../src/errors.js";
import { type LinkCursorOptions, linkCursor } from "../../src/interact/index.js";
import { type SelectionStore, createSelection } from "../../src/selection.js";
import { fgPctByDistance, statsBySide } from "../../src/shots/index.js";
import { BKN } from "../shots/fixture.js";

// Brooklyn's 2000 real 2025-26 shots (fixtures/shots): 1998 within 35 ft. Master's linked charts share ONE distance
// and map it through their own scales: share bars (linear x), FG% bars (3-ft bands), a side chart (y), the signature
// (a rule) and a ring around the hoop.
const byFoot = fgPctByDistance(BKN, 1, 35); // 36 bins; share = attempts / 1998
const by3 = fgPctByDistance(BKN, 3, 35); // 12 bands, 0-33
const sides = statsBySide(BKN, 1, 35, 0); // x == 0 is centre
const HOOP: readonly [number, number] = [0, -41.75]; // feet; the hoop 5.25 ft in from the baseline at y = -47
const D = "distance";

type Fig = ReturnType<typeof Plot.plot>;
const share = (tip = false): Fig =>
  Plot.plot({
    width: 640,
    height: 300,
    marks: [Plot.rectY(byFoot, { x1: "distance", x2: (b) => b.distance + 1, y: "share", tip })],
  });
const fg3 = (): Fig =>
  Plot.plot({ width: 640, height: 300, marks: [Plot.barY(by3, { x: "distance", y: "fgPct" })] });
const side = (): Fig =>
  Plot.plot({
    width: 300,
    height: 400,
    marks: [
      Plot.rect(sides, {
        x1: (b) => -b.left.attempts,
        x2: (b) => b.right.attempts,
        y1: "distance",
        y2: (b) => b.distance + 1,
      }),
    ],
  });
const signature = (): Fig =>
  Plot.plot({
    width: 640,
    height: 300,
    marks: [Plot.line(byFoot, { x: (b) => b.distance + 0.5, y: "fgPct" })],
  });
const court = (): Fig =>
  Plot.plot({
    width: 500,
    height: 470,
    x: { domain: [-25, 25] },
    y: { domain: [-47, 0] },
    marks: [Plot.dot(BKN, { x: (s) => s.x_legacy / 10, y: (s) => s.y_legacy / 10 - 41.75, r: 1 })],
  });

const scale = (f: Fig, n: "x" | "y"): Plot.Scale => {
  const s = f.scale(n);
  if (s === undefined) throw new Error(`no ${n} scale`);
  return s;
};
const px = (f: Fig, n: "x" | "y", v: number): number => Number(scale(f, n).apply(v));
const span = (f: Fig, n: "x" | "y"): [number, number] => {
  const r = Array.from(scale(f, n).range ?? [], Number);
  return [Math.min(...r), Math.max(...r)];
};
const cursorG = (f: Element): Element | null => f.querySelector("g.sdv-cursor");
const part = (f: Element, tag: string): Element => {
  const el = cursorG(f)?.querySelector(tag);
  if (!el) throw new Error(`no cursor ${tag}`);
  return el;
};
const at = (el: Element, a: string): number => Number(el.getAttribute(a));
const shown = (f: Element): boolean => {
  const g = cursorG(f);
  return g !== null && g.getAttribute("display") !== "none";
};
/** A pointer event in svg pixels (jsdom has no layout or createSVGPoint: d3.pointer reads clientX/Y as svg px). */
const fire = (target: Element, type: string, clientX: number, clientY: number): void => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(e, "pointerType", { value: "mouse" }); // jsdom 26 has no PointerEvent; Plot's pointer reads it
  target.dispatchEvent(e);
};
/** A pointer at `ft` along the figure's x axis, halfway up its plot area. */
const overX = (f: Fig, type: string, ft: number): void => {
  const [y0, y1] = span(f, "y");
  fire(f, type, px(f, "x", ft), (y0 + y1) / 2);
};
const cursorOf = <R>(s: SelectionStore<R>): unknown => s.getState().cursor;
// jsdom has no layout: Plot's tip measures its text with getBBox a frame after it draws
Object.defineProperty(SVGElement.prototype, "getBBox", {
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
});

test("one value, four shapes and a rule, each through its own scale (Review Focus 6)", () => {
  const store = createSelection();
  const [s, b, y, sig, c] = [share(), fg3(), side(), signature(), court()];
  linkCursor(s, store, { field: D, shape: { axis: "x", scale: scale(s, "x"), width: 1 } });
  linkCursor(b, store, { field: D, shape: { axis: "x", scale: scale(b, "x") } });
  linkCursor(y, store, { field: D, shape: { axis: "y", scale: scale(y, "y"), width: 1 } });
  linkCursor(sig, store, { field: D, shape: { axis: "x", scale: scale(sig, "x") } });
  linkCursor(c, store, {
    field: D,
    shape: { axis: "ring", x: scale(c, "x"), y: scale(c, "y"), center: HOOP },
  });
  for (const f of [s, b, y, sig, c]) {
    expect(shown(f)).toBe(false); // nothing until a cursor is set
    expect(f.lastElementChild).toBe(cursorG(f)); // above the marks
    expect(cursorG(f)?.getAttribute("pointer-events")).toBe("none");
  }
  store.set({ cursor: { field: D, value: 12.5 } });
  for (const f of [s, b, y, sig, c]) expect(shown(f)).toBe(true);

  // share bars: the 12-13 ft band on a linear x, spanning the plot area's height
  const sr = part(s, "rect");
  expect(at(sr, "x")).toBeCloseTo(px(s, "x", 12));
  expect(at(sr, "width")).toBeCloseTo(px(s, "x", 13) - px(s, "x", 12));
  expect([at(sr, "y"), at(sr, "y") + at(sr, "height")]).toEqual(span(s, "y"));
  // FG% bars: the band holding 12.5 on a band x scale is the 12-14 ft band
  const br = part(b, "rect");
  expect(at(br, "x")).toBe(px(b, "x", 12));
  expect(at(br, "width")).toBe(scale(b, "x").bandwidth);
  // side chart: Y(12)-Y(13) on a linear y, spanning the plot area's width
  const yr = part(y, "rect");
  expect(at(yr, "y")).toBeCloseTo(Math.min(px(y, "y", 12), px(y, "y", 13)));
  expect(at(yr, "height")).toBeCloseTo(Math.abs(px(y, "y", 12) - px(y, "y", 13)));
  expect([at(yr, "x"), at(yr, "x") + at(yr, "width")]).toEqual(span(y, "x"));
  // signature: a rule at 12.5
  const rule = part(sig, "line");
  expect([at(rule, "x1"), at(rule, "x2")]).toEqual([px(sig, "x", 12.5), px(sig, "x", 12.5)]);
  expect([at(rule, "y1"), at(rule, "y2")].sort((p, q) => p - q)).toEqual(span(sig, "y"));
  // the ring around the hoop, radii through the court's x and y scales (master ShotchartCursor.js:11-18)
  const ring = part(c, "ellipse");
  expect([at(ring, "cx"), at(ring, "cy")]).toEqual([px(c, "x", 0), px(c, "y", -41.75)]);
  expect(at(ring, "rx")).toBeCloseTo(Math.abs(px(c, "x", 12.5) - px(c, "x", 0)));
  expect(at(ring, "ry")).toBeCloseTo(Math.abs(px(c, "y", -41.75 + 12.5) - px(c, "y", -41.75)));
  expect(at(ring, "ry")).not.toBeCloseTo(at(ring, "rx")); // its own scales: an ellipse on this frame
});

test("emit, linear + snap: 12.3 ft writes {distance, 12.5} once; inside the bin is silent; 13.1 ft is one more (Review Focus 8)", () => {
  const svg = share();
  const store = createSelection();
  const fn = vi.fn();
  store.subscribe(fn);
  const snap = (v: number): number => Math.floor(v) + 0.5;
  linkCursor(svg, store, { field: D, shape: { axis: "x", scale: scale(svg, "x"), width: 1 }, snap });
  overX(svg, "pointermove", 12.3);
  expect(cursorOf(store)).toEqual({ field: D, value: 12.5 });
  expect(fn).toHaveBeenCalledTimes(1);
  overX(svg, "pointermove", 12.8);
  expect(fn).toHaveBeenCalledTimes(1);
  overX(svg, "pointermove", 13.1);
  expect(cursorOf(store)).toEqual({ field: D, value: 13.5 });
  expect(fn).toHaveBeenCalledTimes(2);
  overX(svg, "pointerdown", 20.9); // a touch press emits too (pointer events cover master's touch handlers)
  expect(cursorOf(store)).toEqual({ field: D, value: 20.5 });
  // without snap the value is the inverted pixel itself
  const raw = createSelection();
  linkCursor(svg, raw, { field: D, shape: { axis: "x", scale: scale(svg, "x") } });
  overX(svg, "pointermove", 12.3);
  expect((raw.getState().cursor?.value ?? 0) - 12.3).toBeCloseTo(0);
});

test("emit on a band scale (no invert): over the 9-11 ft band writes 10.5; the last band its own midpoint", () => {
  const svg = fg3();
  const x = scale(svg, "x");
  const bw = x.bandwidth ?? 0;
  const store = createSelection();
  linkCursor(svg, store, { field: D, shape: { axis: "x", scale: x } });
  const [y0, y1] = span(svg, "y");
  fire(svg, "pointermove", px(svg, "x", 9) + bw * 0.8, (y0 + y1) / 2);
  expect(cursorOf(store)).toEqual({ field: D, value: 10.5 }); // the midpoint of [9, 12)
  fire(svg, "pointermove", px(svg, "x", 33) + bw * 0.2, (y0 + y1) / 2);
  expect(cursorOf(store)).toEqual({ field: D, value: 34.5 }); // [33, 36): one step past the last band start
  // a pointer in the padding between two bands takes the nearer centre: just right of the 9 band's end is 9's
  fire(svg, "pointermove", px(svg, "x", 9) + bw + 1, (y0 + y1) / 2);
  expect(cursorOf(store)).toEqual({ field: D, value: 10.5 });
  // and the follower lights the band it emitted for
  expect(at(part(svg, "rect"), "x")).toBe(px(svg, "x", 9));
});

test("pointerleave, pointercancel and a pointer outside the axis range each clear the cursor in one update", () => {
  const svg = share();
  const store = createSelection();
  const fn = vi.fn();
  store.subscribe(fn);
  linkCursor(svg, store, { field: D, shape: { axis: "x", scale: scale(svg, "x"), width: 1 } });
  const [x0, x1] = span(svg, "x");
  const [y0, y1] = span(svg, "y");
  const ends = ["pointerleave", "pointercancel", "outside"] as const;
  for (const end of ends) {
    overX(svg, "pointermove", 5.5);
    expect(store.getState().cursor).not.toBeNull();
    const before = fn.mock.calls.length;
    if (end === "outside") fire(svg, "pointermove", x0 - 3, (y0 + y1) / 2);
    else fire(svg, end, 0, 0);
    expect(store.getState().cursor).toBeNull();
    expect(fn.mock.calls.length - before).toBe(1);
  }
  fire(svg, "pointermove", x1 + 3, (y0 + y1) / 2); // past the right end, already clear: silent
  expect(fn.mock.calls.length).toBe(ends.length * 2);
  // leaving clears THIS field's cursor only: another chart's (or the app's) value is not this figure's to clear
  store.set({ cursor: { field: "shot_value", value: 3 } });
  fire(svg, "pointerleave", 0, 0);
  expect(store.getState().cursor).toEqual({ field: "shot_value", value: 3 });
});

test("a bar's own pointerleave (the pointer leaves the bar for the plot behind it, same 1 ft bin) writes nothing (Review Focus 8)", () => {
  // pointerleave does not bubble, but a capture listener on the svg hears every mark's own: Chromium fires one on the
  // bar as the pointer moves straight up out of it into empty plot area, without leaving the bin
  const svg = share();
  const store = createSelection();
  const writes: unknown[] = [];
  store.subscribe((s) => writes.push(s.cursor?.value ?? null));
  const snap = (v: number): number => Math.floor(v) + 0.5;
  linkCursor(svg, store, { field: D, shape: { axis: "x", scale: scale(svg, "x"), width: 1 }, snap });
  const bar = svg.querySelectorAll('g[aria-label="rect"] rect')[12]; // the 12-13 ft bar
  if (!bar) throw new Error("no 12 ft bar");
  const [y0, y1] = span(svg, "y");
  fire(svg, "pointermove", px(svg, "x", 12.3), Math.max(y0, y1) - 2); // on the bar, near the baseline
  bar.dispatchEvent(new MouseEvent("pointerleave", { bubbles: false })); // what Chromium fires as it exits the bar
  fire(svg, "pointermove", px(svg, "x", 12.3), Math.min(y0, y1) + 2); // same x, above the bar, same bin
  expect(writes).toEqual([12.5]);
});

test("leaving clears the cursor this figure wrote in one update, never one an app or another figure set since (Review Focus 8)", () => {
  const [s, b] = [share(), fg3()];
  const store = createSelection();
  const fn = vi.fn();
  store.subscribe(fn);
  const snap = (v: number): number => Math.floor(v) + 0.5;
  linkCursor(s, store, { field: D, shape: { axis: "x", scale: scale(s, "x"), width: 1 }, snap });
  linkCursor(b, store, { field: D, shape: { axis: "x", scale: scale(b, "x") } });
  const [x0] = span(s, "x");
  const [y0, y1] = span(s, "y");
  // its own: 12.3 ft writes 12.5, and leaving clears it in one update
  overX(s, "pointermove", 12.3);
  let before = fn.mock.calls.length;
  fire(s, "pointerleave", 0, 0);
  expect([cursorOf(store), fn.mock.calls.length - before]).toEqual([null, 1]);
  // the app sets 20.5 while the pointer is still over the share chart: leaving, cancelling or the margin keeps it
  for (const end of ["pointerleave", "pointercancel", "outside"] as const) {
    overX(s, "pointermove", 12.3);
    store.set({ cursor: { field: D, value: 20.5 } });
    before = fn.mock.calls.length;
    if (end === "outside") fire(s, "pointermove", x0 - 3, (y0 + y1) / 2);
    else fire(s, end, 0, 0);
    expect([cursorOf(store), fn.mock.calls.length - before]).toEqual([{ field: D, value: 20.5 }, 0]);
  }
  // another figure (a second pointer on the FG% bars) wrote the 9-11 ft band's 10.5: the share chart's leave keeps it
  overX(s, "pointermove", 12.3);
  fire(b, "pointermove", px(b, "x", 9) + (scale(b, "x").bandwidth ?? 0) / 2, (y0 + y1) / 2);
  expect(cursorOf(store)).toEqual({ field: D, value: 10.5 });
  fire(s, "pointerleave", 0, 0);
  expect(cursorOf(store)).toEqual({ field: D, value: 10.5 });
  fire(b, "pointerleave", 0, 0); // and the bars' own leave clears it, once
  expect(cursorOf(store)).toBeNull();
});

test("an equal cursor set first by the app stays the app's: entering its bin writes nothing, and leaving keeps it", () => {
  // the store keeps an equal cursor's identity (a no-op patch), so this figure wrote nothing it could clear
  const svg = share();
  const store = createSelection();
  store.set({ cursor: { field: D, value: 12.5 } }); // the app preloads 12.5 ft
  const fn = vi.fn();
  store.subscribe(fn);
  const snap = (v: number): number => Math.floor(v) + 0.5;
  const off = linkCursor(svg, store, {
    field: D,
    shape: { axis: "x", scale: scale(svg, "x"), width: 1 },
    snap,
  });
  overX(svg, "pointermove", 12.3); // the same snapped 12-13 ft bin
  fire(svg, "pointerleave", 0, 0);
  expect([cursorOf(store), fn.mock.calls.length]).toEqual([{ field: D, value: 12.5 }, 0]);
  overX(svg, "pointermove", 12.6); // back in, then torn down: still the app's
  off();
  expect([cursorOf(store), fn.mock.calls.length]).toEqual([{ field: D, value: 12.5 }, 0]);
  // a value it does write is its own: 13.1 ft writes 13.5, and leaving clears it
  linkCursor(svg, store, { field: D, shape: { axis: "x", scale: scale(svg, "x"), width: 1 }, snap });
  overX(svg, "pointermove", 13.1);
  fire(svg, "pointerleave", 0, 0);
  expect([cursorOf(store), fn.mock.calls.length]).toEqual([null, 2]);
});
test("a shape missing a required scale throws InputError, in Node too, never a TypeError (a JavaScript caller)", () => {
  const svg = share();
  const store = createSelection();
  const bad = [
    { axis: "x" }, // no scale
    { axis: "x", scale: { range: [0, 640] } }, // no apply
    { axis: "y", scale: scale(svg, "y"), cross: {} }, // a cross with no apply
    { axis: "ring", x: scale(court(), "x"), center: HOOP }, // no y
  ] as unknown as LinkCursorOptions["shape"][];
  for (const node of [false, true]) {
    if (node) vi.stubGlobal("window", undefined);
    try {
      for (const shape of bad)
        expect(() => linkCursor(svg, store, { field: D, shape, emit: false }), JSON.stringify(shape)).toThrow(
          InputError,
        );
    } finally {
      vi.unstubAllGlobals();
    }
  }
});

test("a missing shape, or a ring centre that is not exactly two finite numbers, throws InputError in Node too", () => {
  const svg = share();
  const store = createSelection();
  const c = court();
  const ring = { axis: "ring", x: scale(c, "x"), y: scale(c, "y") };
  const bad = [
    { field: D }, // no shape
    { field: D, shape: null },
    { field: D, shape: ring }, // no centre
    { field: D, shape: { ...ring, center: [] } }, // every() is vacuously true on []
    { field: D, shape: { ...ring, center: [0] } },
    { field: D, shape: { ...ring, center: [0, -41.75, 3] } },
    { field: D, shape: { ...ring, center: [0, Number.NaN] } },
  ] as unknown as LinkCursorOptions[];
  for (const node of [false, true]) {
    if (node) vi.stubGlobal("window", undefined);
    try {
      for (const o of bad)
        expect(() => linkCursor(svg, store, o), JSON.stringify(o.shape)).toThrow(InputError);
    } finally {
      vi.unstubAllGlobals();
    }
  }
  expect(() =>
    linkCursor(c, store, { field: D, shape: { ...ring, center: HOOP } } as LinkCursorOptions),
  ).not.toThrow();
});

test("a cursor naming another field hides this figure's cursor", () => {
  const svg = share();
  const store = createSelection();
  linkCursor(svg, store, { field: D, shape: { axis: "x", scale: scale(svg, "x"), width: 1 } });
  store.set({ cursor: { field: D, value: 12.5 } });
  expect(shown(svg)).toBe(true);
  store.set({ cursor: { field: "shot_value", value: 3 } });
  expect(shown(svg)).toBe(false);
  store.set({ cursor: { field: D, value: 12.5 } }); // back to the value it last drew: shown again
  expect(shown(svg)).toBe(true);
  store.set({ cursor: null });
  expect(shown(svg)).toBe(false);
  const bands = fg3();
  const s2 = createSelection();
  linkCursor(bands, s2, { field: D, shape: { axis: "x", scale: scale(bands, "x") } });
  s2.set({ cursor: { field: D, value: 50.5 } }); // past the last band: no band holds it
  expect(shown(bands)).toBe(false);
  s2.set({ cursor: { field: D, value: -0.5 } }); // before the first band
  expect(shown(bands)).toBe(false);
  s2.set({ cursor: { field: D, value: 35.5 } }); // 35 ft is in the last band, [33, 36)
  expect(shown(bands)).toBe(true);
});

test("label anchors start at 12.5 ft and end past flipAt (30 of 35 ft); dot sits at cross.apply(dot(value))", () => {
  const svg = share();
  const store = createSelection();
  const label = (v: number): string[] => {
    const b = byFoot[Math.floor(v)];
    return b === undefined
      ? []
      : [`${(100 * b.share).toFixed(1)}%`, `~ ${b.attempts} / 1998`, `@ ${Math.floor(v)} ft`];
  };
  linkCursor(svg, store, { field: D, shape: { axis: "x", scale: scale(svg, "x"), width: 1 }, label });
  store.set({ cursor: { field: D, value: 12.5 } });
  const text = part(svg, "text");
  const lines = (): string[] => Array.from(text.querySelectorAll("tspan"), (t) => t.textContent ?? "");
  expect(lines()).toEqual(["1.2%", "~ 24 / 1998", "@ 12 ft"]);
  expect(text.getAttribute("text-anchor")).toBe("start");
  for (const t of Array.from(text.querySelectorAll("tspan")))
    expect(at(t, "x")).toBeGreaterThan(px(svg, "x", 13));
  store.set({ cursor: { field: D, value: 26.5 } });
  expect(lines()).toEqual(["12.8%", "~ 255 / 1998", "@ 26 ft"]); // the 3-point line: Brooklyn's busiest foot
  expect(text.getAttribute("text-anchor")).toBe("start");
  store.set({ cursor: { field: D, value: 33.5 } }); // 33.5 of 36 is past 30/35 of the axis: flips to the left
  expect(text.getAttribute("text-anchor")).toBe("end");
  for (const t of Array.from(text.querySelectorAll("tspan")))
    expect(at(t, "x")).toBeLessThan(px(svg, "x", 33));
  // flipAt is a fraction of the axis range: 20.5 of 36 is short of 30/35, past 0.5
  const half = share();
  linkCursor(half, store, { field: D, shape: { axis: "x", scale: scale(half, "x") }, label, flipAt: 0.5 });
  store.set({ cursor: { field: D, value: 20.5 } });
  expect(text.getAttribute("text-anchor")).toBe("start");
  expect(part(half, "text").getAttribute("text-anchor")).toBe("end");

  // main's signature dot: on the FG% curve at the cursor, through the figure's own y (cross defaults to it)
  const sig = signature();
  const dot = (v: number): number | null => byFoot[Math.floor(v)]?.fgPct ?? null;
  linkCursor(sig, store, { field: D, shape: { axis: "x", scale: scale(sig, "x") }, dot });
  store.set({ cursor: { field: D, value: 12.5 } });
  const circle = part(sig, "circle");
  expect(circle.getAttribute("r")).toBe("3");
  expect([at(circle, "cx"), at(circle, "cy")]).toEqual([
    px(sig, "x", 12.5),
    px(sig, "y", byFoot[12]?.fgPct ?? Number.NaN),
  ]);
  expect(circle.getAttribute("display")).not.toBe("none");
  store.set({ cursor: { field: D, value: 34.5 } }); // no attempt from 34 ft: no FG%, no dot; the rule stays
  expect(circle.getAttribute("display")).toBe("none");
  expect(shown(sig)).toBe(true);
});

test("moves change attributes only (Review Focus 10): 20 store changes add or remove no element", () => {
  const store = createSelection();
  const figs = [share(), fg3(), side(), signature(), court()];
  const [s, b, y, sig, c] = figs as [Fig, Fig, Fig, Fig, Fig];
  const label = (v: number): string[] => [`@ ${Math.floor(v)} ft`, `${byFoot[Math.floor(v)]?.attempts ?? 0}`];
  linkCursor(s, store, { field: D, shape: { axis: "x", scale: scale(s, "x"), width: 1 }, label });
  linkCursor(b, store, { field: D, shape: { axis: "x", scale: scale(b, "x") } });
  linkCursor(y, store, { field: D, shape: { axis: "y", scale: scale(y, "y"), width: 1 } });
  linkCursor(sig, store, {
    field: D,
    shape: { axis: "x", scale: scale(sig, "x") },
    dot: (v) => byFoot[Math.floor(v)]?.fgPct ?? null,
  });
  linkCursor(c, store, {
    field: D,
    shape: { axis: "ring", x: scale(c, "x"), y: scale(c, "y"), center: HOOP },
  });
  store.set({ cursor: { field: D, value: 0.5 } }); // the first show
  const records: MutationRecord[][] = [];
  const mo = new MutationObserver(() => {});
  for (const f of figs)
    mo.observe(f, { subtree: true, childList: true, attributes: true, characterData: true });
  for (let i = 1; i <= 20; i++) {
    store.set({ cursor: { field: D, value: i + 0.5 } });
    records.push(mo.takeRecords());
  }
  mo.disconnect();
  const all = records.flat();
  expect(all.filter((r) => r.type === "childList")).toEqual([]);
  expect(all.filter((r) => r.type === "attributes").length).toBeGreaterThan(0);
  // O(1) per figure: every change writes the same handful of attributes, whatever the data size (2000 court dots)
  const perChange = records.map((r) => r.filter((m) => m.type === "attributes").length);
  expect(Math.max(...perChange)).toBeLessThanOrEqual(30);
  expect(new Set(perChange).size).toBe(1);
  // a store change that leaves the cursor alone touches nothing
  const mo2 = new MutationObserver(() => {});
  for (const f of figs) mo2.observe(f, { subtree: true, attributes: true });
  store.set({ hover: ["7"], selected: ["8"] });
  expect(mo2.takeRecords()).toEqual([]);
});

test("on a figure with tip: true, a pointerdown still emits the cursor (A34: capture beats Plot's stopImmediatePropagation)", () => {
  const svg = share(true);
  const store = createSelection();
  linkCursor(svg, store, {
    field: D,
    shape: { axis: "x", scale: scale(svg, "x"), width: 1 },
    snap: (v) => Math.floor(v) + 0.5,
  });
  const [y0, y1] = span(svg, "y");
  fire(svg, "pointermove", px(svg, "x", 25.5), px(svg, "y", (byFoot[25]?.share ?? 0) / 2)); // on the 25 ft bar: the tip points
  expect(svg.querySelector('g[aria-label="tip"]')?.children.length).toBeGreaterThan(0);
  store.set({ cursor: null });
  fire(svg, "pointerdown", px(svg, "x", 20.4), (y0 + y1) / 2); // Plot pins the tip and stops other listeners
  expect(store.getState().cursor).toEqual({ field: D, value: 20.5 });
});

test("a d3 figure (A6): its own band scale, no cross; the band spans the svg's viewBox and emits without invert", () => {
  const x = d3
    .scaleBand<number>()
    .domain(by3.map((b) => b.distance))
    .range([40, 620])
    .padding(0.1);
  const svg = d3.create("svg").attr("viewBox", "0 0 640 300").attr("width", 640).attr("height", 300);
  svg
    .selectAll("rect")
    .data(by3)
    .join("rect")
    .attr("x", (b) => x(b.distance) ?? 0)
    .attr("width", x.bandwidth());
  const node = svg.node() as SVGSVGElement;
  const store = createSelection();
  const band = {
    apply: (v: unknown) => x(v as number),
    bandwidth: x.bandwidth(),
    domain: x.domain(),
    range: x.range(),
  };
  linkCursor(node, store, { field: D, shape: { axis: "x", scale: band } });
  store.set({ cursor: { field: D, value: 12.5 } });
  const rect = part(node, "rect");
  expect(at(rect, "x")).toBe(x(12));
  expect(at(rect, "width")).toBeCloseTo(x.bandwidth());
  expect([at(rect, "y"), at(rect, "height")]).toEqual([0, 300]);
  fire(node, "pointermove", (x(27) ?? 0) + 2, 150);
  expect(store.getState().cursor).toEqual({ field: D, value: 28.5 });
});

test("a raw d3 scale goes in as it is (A6, as brushFilter's scales): a band, a linear rule with its cross, a ring", () => {
  // blazing-the-nets' charts are d3: its scales are functions whose range(), bandwidth() and domain() are methods
  const svg = d3.create("svg").attr("viewBox", "0 0 640 300").attr("width", 640).attr("height", 300);
  const node = svg.node() as SVGSVGElement;
  const store = createSelection();
  // FG% bars on a d3 band scale (3 ft bands)
  const band = d3
    .scaleBand<number>()
    .domain(by3.map((b) => b.distance))
    .range([40, 620])
    .padding(0.1);
  linkCursor(node, store, { field: D, shape: { axis: "x", scale: band } });
  // share bars on a d3 linear scale, the band spanning its d3 y range
  const lin = d3.scaleLinear([0, 36], [40, 620]);
  const ly = d3.scaleLinear([0, 0.3], [270, 20]);
  const snap = (v: number): number => Math.floor(v) + 0.5;
  const shareSvg = d3.create("svg").attr("viewBox", "0 0 640 300").node() as SVGSVGElement;
  linkCursor(shareSvg, store, { field: D, shape: { axis: "x", scale: lin, width: 1, cross: ly }, snap });
  // a ring around the hoop on a d3 court
  const cx = d3.scaleLinear([-25, 25], [0, 500]);
  const cy = d3.scaleLinear([-47, 0], [470, 0]);
  const courtSvg = d3.create("svg").attr("viewBox", "0 0 500 470").node() as SVGSVGElement;
  linkCursor(courtSvg, store, { field: D, shape: { axis: "ring", x: cx, y: cy, center: HOOP } });
  store.set({ cursor: { field: D, value: 12.5 } });
  const rect = part(node, "rect");
  expect([shown(node), at(rect, "x")]).toEqual([true, band(12)]);
  expect(at(rect, "width")).toBeCloseTo(band.bandwidth());
  const bar = part(shareSvg, "rect");
  expect([shown(shareSvg), at(bar, "x"), at(bar, "y"), at(bar, "height")]).toEqual([true, lin(12), 20, 250]);
  expect(at(bar, "width")).toBeCloseTo(lin(13) - lin(12));
  const ring = part(courtSvg, "ellipse");
  expect([shown(courtSvg), at(ring, "rx"), at(ring, "ry")]).toEqual([true, 125, 125]); // 12.5 ft: 10 px per foot
  // both emitters write through their d3 scale: the band's midpoint, and the snapped inverted pixel
  fire(node, "pointermove", (band(27) ?? 0) + 2, 150);
  expect(store.getState().cursor).toEqual({ field: D, value: 28.5 });
  fire(shareSvg, "pointermove", lin(20.3), 150);
  expect(store.getState().cursor).toEqual({ field: D, value: 20.5 });
});

test("teardown removes the cursor and its listeners; a figure that wrote no cursor writes nothing", () => {
  const svg = share();
  const store = createSelection();
  const off = linkCursor(svg, store, { field: D, shape: { axis: "x", scale: scale(svg, "x") } });
  const offBand = linkCursor(svg, store, {
    field: D,
    shape: { axis: "x", scale: scale(svg, "x"), width: 1 },
  });
  expect(svg.querySelectorAll('style[data-sdv-interact="cursor"]').length).toBe(1); // A13: once per root
  offBand();
  store.set({ cursor: { field: D, value: 12.3 } }); // another writer's cursor
  const fn = vi.fn();
  store.subscribe(fn);
  off();
  expect(cursorG(svg)).toBeNull();
  expect(fn).not.toHaveBeenCalled();
  overX(svg, "pointermove", 20.3);
  fire(svg, "pointerleave", 0, 0);
  expect(fn).not.toHaveBeenCalled();
  store.set({ cursor: { field: D, value: 3.5 } }); // the store no longer reaches it
  expect(cursorG(svg)).toBeNull();
});

test("teardown clears the cursor this figure wrote while the store still holds it, and never a later one", () => {
  const svg = share();
  const store = createSelection();
  const snap = (v: number): number => Math.floor(v) + 0.5;
  const link = (): (() => void) =>
    linkCursor(svg, store, { field: D, shape: { axis: "x", scale: scale(svg, "x"), width: 1 }, snap });
  const off = link();
  overX(svg, "pointermove", 12.3); // writes {distance, 12.5}
  off(); // the chart is redrawn under the pointer: no pointerleave will come
  expect(cursorOf(store)).toBeNull();
  const again = link();
  overX(svg, "pointermove", 12.3);
  store.set({ cursor: { field: D, value: 20.5 } }); // a cursor the user set later
  again();
  expect(cursorOf(store)).toEqual({ field: D, value: 20.5 });
  const third = link();
  overX(svg, "pointermove", 12.3);
  fire(svg, "pointerleave", 0, 0); // its own clear: it holds no cursor now
  store.set({ cursor: { field: D, value: 12.5 } }); // the user sets the value it once wrote
  third();
  expect(cursorOf(store)).toEqual({ field: D, value: 12.5 });
  const fourth = link();
  overX(svg, "pointermove", 13.3);
  fourth();
  store.set({ cursor: { field: D, value: 13.5 } }); // set again after the teardown
  fourth(); // a second teardown writes nothing
  expect(cursorOf(store)).toEqual({ field: D, value: 13.5 });
});

test("argument errors throw InputError before anything is drawn", () => {
  const svg = share();
  const b = fg3();
  const store = createSelection();
  const x = { axis: "x", scale: scale(svg, "x") } as const;
  const bad: [string, LinkCursorOptions][] = [
    ["empty field", { field: "", shape: x }],
    ["unknown axis", { field: D, shape: { ...x, axis: "z" } as unknown as LinkCursorOptions["shape"] }],
    [
      "non-finite centre",
      { field: D, shape: { axis: "ring", x: scale(svg, "x"), y: scale(svg, "y"), center: [0, Number.NaN] } },
    ],
    [
      "emit on a ring",
      { field: D, emit: true, shape: { axis: "ring", x: scale(svg, "x"), y: scale(svg, "y"), center: HOOP } },
    ],
    ["flipAt 0", { field: D, shape: x, flipAt: 0 }],
    ["flipAt above 1", { field: D, shape: x, flipAt: 1.5 }],
    ["width 0", { field: D, shape: { ...x, width: 0 } }],
    [
      "non-numeric band domain",
      { field: D, shape: { axis: "x", scale: { ...scale(b, "x"), domain: ["rim", "mid"] } } },
    ],
    [
      "emit with neither invert nor bandwidth",
      { field: D, shape: { axis: "x", scale: { apply: (v: unknown) => v, range: [0, 1] } } },
    ],
    [
      "a label on a ring",
      {
        field: D,
        label: () => ["x"],
        shape: { axis: "ring", x: scale(svg, "x"), y: scale(svg, "y"), center: HOOP },
      },
    ],
    [
      "a dot with no cross scale",
      {
        field: D,
        dot: () => 1,
        shape: { axis: "x", scale: { apply: Number, invert: Number, range: [0, 1] } },
      },
    ],
  ];
  const plain = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [what, o] of bad) {
    const root = what.startsWith("a dot") ? plain : svg;
    expect(() => linkCursor(root, store, o), what).toThrow(InputError);
  }
  expect(cursorG(svg)).toBeNull();
  expect(cursorG(plain)).toBeNull();
});
