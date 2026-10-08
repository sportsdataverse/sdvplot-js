import { BKN_SHOTS_2026, NFL_TEAM_EPA_2024, SUPER_BOWL_LIX_WP } from "@sportsdataverse/examples/data";
import { resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { EXAMPLES } from "../src/registry.gen.js";
import { runExample } from "./run.js";

// What a gallery figure claims about its data, checked on the figure the docs serve.
const figure = async (id: string): Promise<Element> => {
  const entry = EXAMPLES.find((e) => e.id === id);
  if (entry === undefined) throw new Error(`no example ${id}`);
  return (await runExample(entry)).value as Element;
};

beforeAll(() => {
  // jsdom has no SVG text metrics; Plot measures a tip only once it is shown.
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  proto.getBBox ??= () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
});

test("logos-tip: a better defence plots higher, the axis says so, and the tip names the plain metric", async () => {
  const fig = await figure("sdvplot/plot/logos-tip");
  const img = (slug: string): Element => {
    const el = fig.querySelector(`a[href="https://www.espn.com/nfl/team/_/name/${slug}"] image`);
    if (el === null) throw new Error(`no logo linked to ${slug}`);
    return el;
  };
  const centre = (el: Element): [number, number] => {
    const n = (k: string): number => Number(el.getAttribute(k));
    return [n("x") + n("width") / 2, n("y") + n("height") / 2];
  };
  const def = (team: string): number => {
    const t = NFL_TEAM_EPA_2024.find((r) => r.team === team);
    return t === undefined ? Number.NaN : t.def_epa / t.def_plays;
  };
  // BAL allowed -0.018 EPA per play, ARI +0.051: fewer allowed is the better defence, drawn higher up the page.
  expect(def("BAL")).toBeCloseTo(-0.018, 3);
  expect(def("ARI")).toBeCloseTo(0.051, 3);
  expect(centre(img("bal"))[1]).toBeLessThan(centre(img("ari"))[1]);
  expect(fig.querySelector('g[aria-label="y-axis label"]')?.textContent).toBe(
    "↑ Better defence (defensive EPA/play allowed, reversed)",
  );
  // The tip reads the y scale's own label: the metric, with no arrow to contradict the reversed axis.
  const svg = fig.querySelector("svg") ?? fig;
  const [x, y] = centre(img("ari"));
  svg.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y, bubbles: true }));
  const tip = Array.from(fig.querySelectorAll("g[aria-label=tip] tspan"), (t) => t.textContent).join(" ");
  expect(tip).toContain("Defensive EPA/play allowed 0.051");
  expect(tip).toContain("Offensive EPA/play 0.068");
  expect(tip).not.toMatch(/[↑↓→←]/);
});

test("logos-tip: every logo links to its ESPN team page, by ESPN's abbreviation (WAS is wsh, LA is lar)", async () => {
  const fig = await figure("sdvplot/plot/logos-tip");
  const slugs = Array.from(fig.querySelectorAll("a"), (a) => a.getAttribute("href")?.split("/name/")[1]);
  expect(slugs).toHaveLength(32);
  expect(new Set(slugs).size).toBe(32);
  expect(slugs).toEqual(expect.arrayContaining(["wsh", "lar", "kc", "lv", "jax"]));
  expect(slugs).not.toContain("was");
  expect(slugs).not.toContain("la");
});

test("rolling-form: every point is a full 4-game mean, so each 17-game line starts at its 4th game", async () => {
  const fig = await figure("sdvplot/plot/rolling-form");
  const lines = Array.from(
    fig.querySelectorAll('g[aria-label="line"] path'),
    (p) => p.getAttribute("d") ?? "",
  );
  expect(lines).toHaveLength(2);
  for (const d of lines) expect(d.match(/[ML]/g)).toHaveLength(17 - 3);
});

test("win-probability-difference: the caption's claim that Kansas City never led is the data's", async () => {
  const fig = await figure("sdvplot/plot/win-probability-difference");
  const min = Math.min(...SUPER_BOWL_LIX_WP.map((d) => d.home_wp));
  expect(min).toBeGreaterThan(0.5);
  expect(fig.querySelector("figcaption")?.textContent).toContain(`${(min * 100).toFixed(1)}%`);
});

test("shot dashboard: the menu swaps the court under a hovered cell, both ways, with no warning and nothing dimmed", async () => {
  const root = await figure("sdvplot/shots/dashboard");
  const select = root.querySelector('select[aria-label="Cell shape"]') as HTMLSelectElement;
  const warnings: string[] = [];
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
  try {
    for (const shape of ["square", "hex"]) {
      // hover a cell as Plot's tip does: `value` on the figure, then `input`
      const court = select.nextElementSibling as Element;
      const [x, y] = (court.querySelector("[data-sdv-id]")?.getAttribute("data-sdv-id") ?? "")
        .split(",")
        .map(Number);
      Object.defineProperty(court, "value", { value: { x, y }, configurable: true });
      court.dispatchEvent(new Event("input", { bubbles: true }));
      expect(court.classList.contains("sdv-focus")).toBe(true);
      select.value = shape;
      select.dispatchEvent(new Event("change"));
      const next = select.nextElementSibling as Element;
      expect(next).not.toBe(court);
      expect(next.classList.contains("sdv-focus")).toBe(false);
      expect(next.querySelector(".sdv-hl")).toBeNull();
    }
    expect(warnings).toEqual([]); // the new court never sees the old court's hover id
  } finally {
    setWarningHandler(null);
  }
});

// The shot dashboard's five figures in page order: court, signature, share, FG% and side.
type Fig = SVGSVGElement & {
  scale: (n: string) => {
    range?: readonly number[];
    apply: (v: number) => number;
    invert?: (p: number) => number;
  };
};
const figures = async (id: string): Promise<Fig[]> =>
  Array.from((await figure(id)).querySelectorAll("svg")).filter(
    (s): s is Fig => typeof (s as Partial<Fig>).scale === "function",
  );
const dashboard = (): Promise<Fig[]> => figures("sdvplot/shots/dashboard");
const span = (f: Fig, n: string): [number, number] => {
  const r = Array.from(f.scale(n)?.range ?? [], Number);
  return [Math.min(...r), Math.max(...r)];
};
const at = (r: Element, a: string): number => Number(r.getAttribute(a));
const end = (r: Element): number => at(r, "x") + at(r, "width");

/** Each figure's bar and rect count, and every bar drawn outside its plot area (1 px slack). */
const barsOutside = (figs: Fig[]): { bars: number[]; outside: string[] } => {
  const outside: string[] = [];
  const bars = figs.map((f) => {
    const [[x0, x1], [y0, y1]] = [span(f, "x"), span(f, "y")];
    const rects = f.querySelectorAll('g[aria-label="bar"] rect, g[aria-label="rect"] rect');
    for (const r of rects)
      if (
        !(
          at(r, "x") >= x0 - 1 &&
          end(r) <= x1 + 1 &&
          at(r, "y") >= y0 - 1 &&
          at(r, "y") + at(r, "height") <= y1 + 1
        )
      )
        outside.push(r.outerHTML);
    return rects.length;
  });
  return { bars, outside };
};

test("shot dashboard: every bar of every figure sits inside its plot (FG% is a percent scale on [0, 100])", async () => {
  const figs = await dashboard();
  expect(figs).toHaveLength(5);
  const { bars, outside } = barsOutside(figs);
  expect(outside).toEqual([]);
  expect(bars.slice(2).every((n) => n > 0)).toBe(true); // the share, FG% and side charts draw bars
});
test("linkCursor gallery: every bar of every figure sits inside its plot (FG% is a percent scale on [0, 100])", async () => {
  const figs = await figures("sdvplot/plot/link-cursor"); // share, FG%, side and the court
  expect(figs).toHaveLength(4);
  const { bars, outside } = barsOutside(figs);
  expect(outside).toEqual([]);
  expect(bars.slice(0, 3).every((n) => n > 0)).toBe(true); // the share, FG% and side charts draw bars
});

// main's side chart (blazing-the-nets lib/charts/sideChart.ts:20-22, :66-75): left and right grow from a FIXED centre
// column's edges, so the 0-ft row (70 left, 60 centre, 70 right) reads 70 a side
test("shot dashboard: x < 0 shots grow left of a fixed centre column, x > 0 right; the axis reads attempts from its edges", async () => {
  const side = (await dashboard())[4] as Fig;
  const [left = [], centre = [], right = []] = Array.from(
    side.querySelectorAll('g[aria-label="rect"]'),
    (g) => Array.from(g.querySelectorAll("rect")),
  );
  const inner = [...new Set(left.map(end)), ...new Set(right.map((r) => at(r, "x")))];
  expect(inner).toHaveLength(2); // every row's left bar ends, and every right bar starts, at one x: the column's edges
  const [l = Number.NaN, r = Number.NaN] = inner;
  expect(r - l).toBeGreaterThan(0);
  for (const c of centre) expect([at(c, "x") >= l, end(c) <= r]).toEqual([true, true]);
  const k = side.scale("x").apply(1) - side.scale("x").apply(0); // px per attempt
  const row = (b: Element): number =>
    Math.floor(Number(side.scale("y").invert?.(at(b, "y") + at(b, "height") / 2)));
  const n = (ft: number, on: (x: number) => boolean): number =>
    BKN_SHOTS_2026.filter(
      (s) => s.shot_distance <= 35 && Math.floor(s.shot_distance) === ft && on(s.x_legacy),
    ).length;
  for (const b of left) expect(at(b, "width")).toBeCloseTo(n(row(b), (x) => x < 0) * k);
  for (const b of right) expect(at(b, "width")).toBeCloseTo(n(row(b), (x) => x > 0) * k);
  expect(left.some((b) => n(row(b), (x) => x < 0) !== n(row(b), (x) => x > 0))).toBe(true); // so a swap shows
  const ticks = Array.from(side.querySelectorAll('g[aria-label="x-axis tick label"] text'));
  expect(ticks.length).toBeGreaterThan(2);
  for (const t of ticks) {
    const x = Number(/translate\(([-\d.]+)/.exec(t.getAttribute("transform") ?? "")?.[1]);
    expect(Number(t.textContent)).toBeCloseTo((Math.abs(x - (l + r) / 2) - (r - l) / 2) / k, 0);
  }
});
