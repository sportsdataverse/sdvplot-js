// @vitest-environment jsdom
import { surface } from "@sportsdataverse/sporty";
import { cleanup, configure, render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { loadLeague, resetWarnings, setWarningHandler, teamColorsSync } from "../../src/index.js";
import { SurfaceBackdrop } from "../../src/react/index.js";

await loadLeague("nba");

beforeEach(() => resetWarnings());
afterEach(() => {
  cleanup();
  setWarningHandler(null);
});
vi.setConfig({ testTimeout: 20_000 });
// The backdrop's first render waits on a dynamic import (recharts, sporty), which takes well over waitFor's default
// 1 s on a busy machine: seen timing out once in a full `pnpm test`. Raise the ceiling, not the expectation.
configure({ asyncUtilTimeout: 15_000 });

const court = surface("basketball", "nba", { displayRange: "defense" });
const [x0, y0, x1, y1] = court.bbox;
const MARGIN = { top: 10, right: 10, bottom: 10, left: 10 };

function chart(backdrop: ReactElement, domainX: [number, number] = [x0, x1]) {
  return render(
    <ScatterChart width={500} height={480} margin={MARGIN}>
      <XAxis type="number" dataKey="x" domain={domainX} hide allowDataOverflow />
      <YAxis type="number" dataKey="y" domain={[y0, y1]} hide allowDataOverflow />
      {backdrop}
      <Scatter data={[{ x: 0, y: 0 }]} isAnimationActive={false} fill="#000" />
    </ScatterChart>,
  );
}

test("SurfaceBackdrop paints the league's team-painted surface over the plot area, under the series", async () => {
  const { container } = chart(<SurfaceBackdrop league="nba" team="DEN" displayRange="defense" />);
  const scene = await waitFor(() => {
    const s = container.querySelector("g[data-sdv-surface] svg");
    expect(s).not.toBeNull();
    return s as Element;
  });
  // the axes' domains are the scene's bbox, so the surface fills the plot area exactly
  expect(Number(scene.getAttribute("x"))).toBeCloseTo(MARGIN.left);
  expect(Number(scene.getAttribute("y"))).toBeCloseTo(MARGIN.top);
  expect(Number(scene.getAttribute("width"))).toBeCloseTo(500 - MARGIN.left - MARGIN.right);
  expect(Number(scene.getAttribute("height"))).toBeCloseTo(480 - MARGIN.top - MARGIN.bottom);
  expect(scene.getAttribute("preserveAspectRatio")).toBe("none");
  expect(scene.innerHTML).toContain("<path");
  expect(scene.querySelector("g")?.getAttribute("aria-description")).toBe("nba basketball surface");
  // Denver's painted area: the team colour is on the court
  const den = teamColorsSync("nba", ["DEN"])[0] as string;
  expect(scene.innerHTML.toLowerCase()).toContain(`fill="${den.toLowerCase()}"`);
  // under the series: the backdrop comes before the scatter symbols in document order
  const all = [...container.querySelectorAll("g[data-sdv-surface], .recharts-scatter-symbol")];
  expect(all[0]?.hasAttribute("data-sdv-surface")).toBe(true);
});

test("a bigint team id renders (the memo key does not JSON.stringify a bigint)", async () => {
  const { container } = chart(<SurfaceBackdrop league="nba" team={1610612743n} displayRange="defense" />);
  await waitFor(() => expect(container.querySelector("g[data-sdv-surface] svg")).not.toBeNull());
});

test("a domain wider than the surface maps the scene's bbox into data coordinates, clipped to the plot area", async () => {
  const w = x1 - x0;
  const { container } = chart(<SurfaceBackdrop league="nba" displayRange="defense" />, [
    x0 - w / 2,
    x1 + w / 2,
  ]);
  const scene = await waitFor(() => {
    const s = container.querySelector("g[data-sdv-surface] svg");
    expect(s).not.toBeNull();
    return s as Element;
  });
  const plotW = 500 - MARGIN.left - MARGIN.right;
  expect(Number(scene.getAttribute("width"))).toBeCloseTo(plotW / 2);
  expect(Number(scene.getAttribute("x"))).toBeCloseTo(MARGIN.left + plotW / 4);
  expect(container.querySelector("g[data-sdv-surface] clipPath rect")).not.toBeNull();
});

/** Render `axes` around a backdrop, wait for its first warning, and say whether any surface was drawn. */
async function warned(axes: ReactElement): Promise<{ message: string; drawn: boolean }> {
  const spy = vi.fn();
  setWarningHandler(spy);
  const { container } = render(
    <ScatterChart width={500} height={480} margin={MARGIN}>
      {axes}
      <SurfaceBackdrop league="nba" displayRange="defense" />
      <Scatter data={[{ x: 1, y: 1 }]} isAnimationActive={false} />
    </ScatterChart>,
  );
  await waitFor(() => expect(spy).toHaveBeenCalled());
  return {
    message: String(spy.mock.calls[0]?.[0]),
    drawn: container.querySelector("g[data-sdv-surface]") !== null,
  };
}

test("a reversed axis draws no surface and warns, rather than a mirrored court", async () => {
  const r = await warned(
    <>
      <XAxis type="number" dataKey="x" domain={[x0, x1]} reversed />
      <YAxis type="number" dataKey="y" domain={[y0, y1]} />
    </>,
  );
  expect(r.drawn).toBe(false);
  expect(r.message).toMatch(/reversed or log/);
});

test("a log axis draws no surface and warns", async () => {
  const r = await warned(
    <>
      <XAxis type="number" dataKey="x" domain={[x0, x1]} />
      <YAxis type="number" dataKey="y" domain={[1, 100]} scale="log" allowDataOverflow />
    </>,
  );
  expect(r.drawn).toBe(false);
  expect(r.message).toMatch(/reversed or log/);
});

test("a category axis (a non-numeric domain) draws no surface and warns", async () => {
  const r = await warned(
    <>
      <XAxis type="category" dataKey="x" />
      <YAxis type="number" dataKey="y" domain={[y0, y1]} />
    </>,
  );
  expect(r.drawn).toBe(false);
  expect(r.message).toMatch(/type="number"/);
});
