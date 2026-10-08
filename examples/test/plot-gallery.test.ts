import { NFL_TEAM_EPA_2024, SUPER_BOWL_LIX_WP } from "@sportsdataverse/examples/data";
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

test("shot dashboard: every bar of every figure sits inside its plot (FG% is a percent scale on [0, 100])", async () => {
  const root = await figure("sdvplot/shots/dashboard");
  type Fig = SVGSVGElement & { scale: (n: string) => { range?: readonly number[] } | undefined };
  const figs = Array.from(root.querySelectorAll("svg")).filter(
    (s): s is Fig => typeof (s as Partial<Fig>).scale === "function",
  );
  expect(figs).toHaveLength(5);
  const span = (f: Fig, n: string): [number, number] => {
    const r = Array.from(f.scale(n)?.range ?? [], Number);
    return [Math.min(...r), Math.max(...r)];
  };
  const at = (r: Element, a: string): number => Number(r.getAttribute(a));
  const outside: string[] = [];
  const bars = figs.map((f) => {
    const [[x0, x1], [y0, y1]] = [span(f, "x"), span(f, "y")];
    const rects = f.querySelectorAll('g[aria-label="bar"] rect, g[aria-label="rect"] rect');
    for (const r of rects)
      if (
        !(
          at(r, "x") >= x0 - 1 &&
          at(r, "x") + at(r, "width") <= x1 + 1 &&
          at(r, "y") >= y0 - 1 &&
          at(r, "y") + at(r, "height") <= y1 + 1
        )
      )
        outside.push(r.outerHTML);
    return rects.length;
  });
  expect(outside).toEqual([]);
  expect(bars.slice(2).every((n) => n > 0)).toBe(true); // court and signature first, then the share, FG% and side bars
});
