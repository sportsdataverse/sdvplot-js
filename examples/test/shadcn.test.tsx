import { loadLeague, logoUrlSync, resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { teamChartConfig } from "@sportsdataverse/sdvplot/shadcn";
import { type ReactElement, act } from "react";
import { createRoot } from "react-dom/client";
import { Bar, BarChart, Line, LineChart, XAxis } from "recharts";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "../src/vendor/shadcn/chart.js";

/**
 * sdvplot/shadcn's config drawn through the vendored shadcn chart.tsx (examples/src/vendor/shadcn), in jsdom: the
 * <style> its ChartStyle writes, the series' colours, and the logos its legend and tooltip draw.
 */
const TEAMS = ["KC", "LAC", "DEN", "LV"];
const SIZE = { width: 480, height: 300 };
let host: HTMLDivElement | undefined;

beforeAll(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await Promise.all([loadLeague("nfl"), loadLeague("ncaa_whockey")]);
});
afterEach(() => {
  host?.remove();
  resetWarnings();
});

async function mount(el: ReactElement): Promise<HTMLDivElement> {
  host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () => root.render(el));
  // recharts lays out on a later tick: wait for the series
  await vi.waitFor(
    () => {
      if (host?.querySelector(".recharts-layer") === null) throw new Error("not drawn yet");
    },
    { timeout: 15_000 },
  );
  await act(() => new Promise<void>((r) => setTimeout(r, 50)));
  return host;
}

/** `{ key: value }` of each `--color-*` the chart's <style> sets in the block starting with `selector`. */
function colorsIn(css: string, selector: string): Record<string, string> {
  const block = css.slice(css.indexOf(`${selector} {`)).split("}")[0] ?? "";
  return Object.fromEntries([...block.matchAll(/--color-([^:]+): ([^;]+);/g)].map((m) => [m[1], m[2]]));
}

test("ChartStyle writes each team's --color-<key>: theme.light under the chart, theme.dark under .dark", async () => {
  const { config, keys } = teamChartConfig("nfl", TEAMS);
  const rows = [1, 2].map((week) => ({ week, ...Object.fromEntries(keys.map((k, i) => [k, week + i])) }));
  const el = await mount(
    <ChartContainer id="t-style" config={config} initialDimension={SIZE}>
      <LineChart data={rows}>
        <XAxis dataKey="week" />
        {keys.map((k) => (
          <Line key={k} dataKey={k} stroke={`var(--color-${k})`} isAnimationActive={false} />
        ))}
      </LineChart>
    </ChartContainer>,
  );
  const css = el.querySelector("style")?.textContent ?? "";
  const want = (theme: "light" | "dark") => Object.fromEntries(keys.map((k) => [k, config[k]?.theme[theme]]));
  expect(colorsIn(css, " [data-chart=chart-t-style]")).toEqual(want("light"));
  expect(colorsIn(css, ".dark [data-chart=chart-t-style]")).toEqual(want("dark"));
  // each line strokes with its key's variable (the docs render test reads the colour Chromium resolves for it)
  expect([...el.querySelectorAll(".recharts-line-curve")].map((p) => p.getAttribute("stroke"))).toEqual(
    keys.map((k) => `var(--color-${k})`),
  );
});

test("ChartLegendContent draws each team's logo and name; a team with no logo keeps shadcn's swatch", async () => {
  const { config, keys } = teamChartConfig("nfl", TEAMS);
  const rows = [{ week: 1, ...Object.fromEntries(keys.map((k, i) => [k, i])) }];
  const el = await mount(
    <ChartContainer id="t-legend" config={config} initialDimension={SIZE}>
      <LineChart data={rows}>
        <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
        {keys.map((k) => (
          <Line key={k} dataKey={k} isAnimationActive={false} />
        ))}
      </LineChart>
    </ChartContainer>,
  );
  const items = [...el.querySelectorAll(".recharts-legend-wrapper .gap-1\\.5")];
  expect(items.map((d) => d.textContent)).toEqual([
    "Kansas City Chiefs",
    "Los Angeles Chargers",
    "Denver Broncos",
    "Las Vegas Raiders",
  ]);
  expect(items.map((d) => d.querySelector("img")?.getAttribute("src"))).toEqual(
    TEAMS.map((t) => logoUrlSync(t, "nfl")),
  );

  const spy = vi.fn();
  setWarningHandler(spy);
  const hockey = teamChartConfig("ncaa_whockey", ["DEL"]);
  setWarningHandler(null);
  expect(spy).toHaveBeenCalledTimes(1);
  host?.remove();
  const swatch = await mount(
    <ChartContainer id="t-swatch" config={hockey.config} initialDimension={SIZE}>
      <LineChart data={[{ week: 1, del: 1 }]}>
        <ChartLegend content={<ChartLegendContent />} />
        <Line dataKey="del" stroke="var(--color-del)" isAnimationActive={false} />
      </LineChart>
    </ChartContainer>,
  );
  const item = swatch.querySelector(".recharts-legend-wrapper .gap-1\\.5");
  expect(item?.textContent).toBe("Delaware Blue Hens");
  expect(item?.querySelector("img")).toBeNull();
  expect(item?.querySelector(".rounded-\\[2px\\]")).not.toBeNull(); // shadcn's colour swatch
});

test("ChartTooltipContent with nameKey shows the bar's team logo and name; the bars fill var(--color-<key>)", async () => {
  const { config, keys } = teamChartConfig("nfl", TEAMS);
  const rows = TEAMS.map((team, i) => ({ team, key: keys[i], pf: 300 + i, fill: `var(--color-${keys[i]})` }));
  const el = await mount(
    <ChartContainer id="t-tooltip" config={config} initialDimension={SIZE}>
      <BarChart data={rows}>
        <XAxis dataKey="team" />
        <ChartTooltip defaultIndex={2} active content={<ChartTooltipContent nameKey="key" hideLabel />} />
        <Bar dataKey="pf" isAnimationActive={false} />
      </BarChart>
    </ChartContainer>,
  );
  expect([...el.querySelectorAll(".recharts-bar-rectangle path")].map((p) => p.getAttribute("fill"))).toEqual(
    keys.map((k) => `var(--color-${k})`),
  );
  await vi.waitFor(() => {
    if (el.querySelector(".recharts-tooltip-wrapper img") === null) throw new Error("no tooltip yet");
  });
  const tip = el.querySelector(".recharts-tooltip-wrapper") as HTMLElement;
  expect(tip.querySelector("img")?.getAttribute("src")).toBe(logoUrlSync("DEN", "nfl"));
  expect(tip.textContent).toContain("Denver Broncos");
  expect(tip.textContent).toContain("302");
});
