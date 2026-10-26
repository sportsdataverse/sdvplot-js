// @vitest-environment jsdom
// sdvplot/chartjs through react-chartjs-2 (5.3.1): it creates the chart in an effect with the props' `plugins` (read
// then only), then on a prop change copies `options` onto the chart (Object.assign), swaps `data.labels`, merges each
// dataset in place (matched by `label`) and calls `chart.update()`; on unmount it destroys the chart.
import { cleanup, render } from "@testing-library/react";
import { Chart as ChartJS, type ChartOptions, type Plugin, registerables } from "chart.js";
import { type ReactElement, StrictMode, createRef } from "react";
import { Chart } from "react-chartjs-2";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { surface } from "../../src/chartjs-surface.js";
import { axisLogos, logoPoints, logoWatermarks, pointImages, teamColor } from "../../src/chartjs.js";
import { loadLeague, resetWarnings } from "../../src/index.js";
import { type Call, calls, mockCanvas } from "./harness.js";

ChartJS.register(...registerables);
beforeAll(async () => {
  await loadLeague("nfl");
  await loadLeague("nba");
  mockCanvas();
});
afterEach(() => {
  cleanup();
  resetWarnings();
});

const WEST = ["KC", "LAC", "DEN", "LV"];
const EAST = ["BUF", "MIA", "NYJ", "NE"];
const BASE = { responsive: false, animation: false, devicePixelRatio: 1 } as const;
/** The chart react-chartjs-2 made, through its forwarded ref. */
type Ref = { current: ChartJS | null };
/** What the chart's context has recorded since it was created (Chart.js asks for the context once per chart). */
const log = (chart: ChartJS): Call[] => calls.get(chart.canvas) ?? [];
/** The images drawn at `h` px tall since the log was last cleared. */
const drawn = (chart: ChartJS, h: number): unknown[] =>
  log(chart)
    .filter(([n, a]) => n === "drawImage" && a[4] === h)
    .map(([, a]) => a[0]);
const ids = (chart: ChartJS): string[] => (chart.config.plugins ?? []).map((p) => p.id);
const live = (): number => Object.keys(ChartJS.instances).length;
/** The x scale's resolved tick padding. */
const tickPadding = (chart: ChartJS): unknown =>
  (chart.scales.x?.options as { ticks?: { padding?: number } } | undefined)?.ticks?.padding;

/** A logo scatter as a React user writes it: the points and the plugin list are rebuilt on every render. */
function Logos({ teams, chart }: { teams: readonly string[]; chart: Ref }): ReactElement {
  return (
    <Chart
      ref={chart as never}
      type="scatter"
      width={600}
      height={400}
      data={{
        datasets: [
          {
            label: "teams",
            data: teams.map((_, i) => ({ x: i, y: i })),
            ...logoPoints(teams, { league: "nfl", radius: 12 }),
          },
        ],
      }}
      options={BASE}
      plugins={[pointImages]}
    />
  );
}

describe("logoPoints + pointImages", () => {
  test("first render: each point is its team's logo, in data order", () => {
    const chart: Ref = createRef();
    render(<Logos teams={WEST} chart={chart} />);
    const c = chart.current as ChartJS;
    expect(drawn(c, 24)).toEqual(logoPoints(WEST, { league: "nfl", radius: 12 }).pointStyle);
  });
  test("new teams, same component: the same chart is updated in place and draws only the new logos", () => {
    const chart: Ref = createRef();
    const { rerender } = render(<Logos teams={WEST} chart={chart} />);
    const first = chart.current as ChartJS;
    log(first).length = 0;
    rerender(<Logos teams={EAST} chart={chart} />);
    expect(chart.current).toBe(first); // updated, not rebuilt
    const east = logoPoints(EAST, { league: "nfl", radius: 12 }).pointStyle;
    const west = logoPoints(WEST, { league: "nfl", radius: 12 }).pointStyle;
    expect(drawn(first, 24)).toEqual(east);
    expect(drawn(first, 24).filter((img) => west.includes(img as never))).toEqual([]); // no stale logo
    expect(ids(first)).toEqual(["sdvplotPointImages"]); // the re-rendered plugin list was not added again
    expect(live()).toBe(1);
  });
  test("StrictMode (mount, unmount, mount): one live chart, and it draws the logos", () => {
    const chart: Ref = createRef();
    render(
      <StrictMode>
        <Logos teams={WEST} chart={chart} />
      </StrictMode>,
    );
    expect(live()).toBe(1);
    expect(drawn(chart.current as ChartJS, 24)).toEqual(
      logoPoints(WEST, { league: "nfl", radius: 12 }).pointStyle,
    );
  });
  test("unmount: the chart is destroyed, nothing is registered globally, and a pending load is let go", () => {
    // a logo of its own size (a fresh cached element) that is still loading: pointImages waits on it
    const [img] = logoPoints(["KC"], { league: "nfl", radius: 17 }).pointStyle as [HTMLImageElement];
    Object.defineProperty(img, "complete", { value: false, configurable: true });
    const signals: AbortSignal[] = [];
    const listen = img.addEventListener.bind(img);
    const spy = vi.spyOn(img, "addEventListener").mockImplementation((type, f, o) => {
      if (typeof o === "object" && o.signal !== undefined) signals.push(o.signal);
      listen(type, f, o);
    });
    try {
      const chart: Ref = createRef();
      const Pending = (): ReactElement => (
        <Chart
          ref={chart as never}
          type="scatter"
          width={600}
          height={400}
          data={{ datasets: [{ label: "kc", data: [{ x: 1, y: 1 }], pointStyle: [img], pointRadius: 17 }] }}
          options={BASE}
          plugins={[pointImages]}
        />
      );
      const { unmount } = render(<Pending />);
      const c = chart.current as ChartJS;
      expect(signals.length).toBeGreaterThan(0);
      expect(signals.every((s) => !s.aborted)).toBe(true);
      unmount();
      expect(live()).toBe(0);
      expect(c.ctx).toBeNull(); // destroyed
      expect(signals.every((s) => s.aborted)).toBe(true); // the load listener went with the chart
      // the sdvplot plugins are per chart (the `plugins` prop); only ChartJS.register(...) is global
      for (const id of ["sdvplotPointImages", "sdvplotAxisLogosX", "sdvplotLogoWatermarks", "sdvplotSurface"])
        expect(ChartJS.registry.plugins.get(id)).toBeUndefined();
    } finally {
      spy.mockRestore();
      Reflect.deleteProperty(img, "complete");
    }
  });
});

/** Team-coloured bars with logo ticks, as a React user writes it: options and the plugin are new on every render. */
function Bars({ teams, chart }: { teams: readonly string[]; chart: Ref }): ReactElement {
  const options: ChartOptions<"bar"> = { ...BASE, scales: { x: { type: "category" } } };
  return (
    <Chart
      ref={chart as never}
      type="bar"
      width={600}
      height={400}
      data={{
        labels: [...teams],
        datasets: [
          { label: "wins", data: teams.map((_, i) => i + 1), backgroundColor: teamColor(teams, "nfl") },
        ],
      }}
      options={options}
      plugins={[axisLogos("x", { league: "nfl", size: 24 })]}
    />
  );
}

describe("axisLogos + teamColor", () => {
  test("new labels: the first axisLogos keeps working from the chart's labels; bars take the new colours; no padding creep", () => {
    const chart: Ref = createRef();
    const { rerender } = render(<Bars teams={WEST} chart={chart} />);
    const c = chart.current as ChartJS;
    const plugin = c.config.plugins?.[0];
    expect(drawn(c, 24)).toHaveLength(4);
    expect(c.scales.x?.ticks.map((t) => t.label)).toEqual(["", "", "", ""]);
    const padding = tickPadding(c);
    expect(padding).toBe(3 + 24); // Chart.js's 3 + the logo band
    for (const teams of [EAST, WEST, EAST]) {
      log(c).length = 0;
      rerender(<Bars teams={teams} chart={chart} />);
      expect(chart.current).toBe(c);
      expect(c.config.plugins?.[0]).toBe(plugin); // react-chartjs-2 kept the first plugin; the new ones are unused
      expect(ids(c)).toEqual(["sdvplotAxisLogosX"]);
      const srcs = (drawn(c, 24) as HTMLImageElement[]).map((img) => img.src);
      const want = (logoPoints(teams, { league: "nfl", radius: 12 }).pointStyle as HTMLImageElement[]).map(
        (img) => img.src,
      );
      expect(srcs).toEqual(want); // each tick's logo is the new label's
      expect(tickPadding(c)).toBe(padding); // wired once per options copy, never stacked
      const bars = c
        .getDatasetMeta(0)
        .data.map((b) => (b.options as { backgroundColor: string }).backgroundColor);
      expect(bars).toEqual(teamColor(teams, "nfl"));
    }
  });
});

/** Faint logos behind a line: the teams are baked into the plugin when it is built. */
function Watermarked({ teams, chart, keyed }: { teams: readonly string[]; chart: Ref; keyed: boolean }) {
  return (
    <Chart
      key={keyed ? teams.join() : undefined}
      ref={chart as never}
      type="line"
      width={600}
      height={400}
      data={{ labels: [0, 1, 2], datasets: [{ label: "wp", data: [0.5, 0.7, 0.2] }] }}
      options={BASE}
      plugins={[logoWatermarks(teams, { league: "nfl", size: 50 })]}
    />
  );
}

describe("logoWatermarks and surface: plugins are read when the chart is created", () => {
  const marks = (teams: readonly string[]): string[] =>
    (logoPoints(teams, { league: "nfl", radius: 25 }).pointStyle as HTMLImageElement[]).map((img) => img.src);
  test("without a key the first teams stay (react-chartjs-2 never reads `plugins` again); a key that names the teams rebuilds the chart with them", () => {
    const chart: Ref = createRef();
    const { rerender } = render(<Watermarked teams={["KC", "PHI"]} chart={chart} keyed={false} />);
    const c = chart.current as ChartJS;
    expect((drawn(c, 50) as HTMLImageElement[]).map((i) => i.src)).toEqual(marks(["KC", "PHI"]));
    log(c).length = 0;
    rerender(<Watermarked teams={["BUF", "BAL"]} chart={chart} keyed={false} />);
    expect(chart.current).toBe(c);
    expect((drawn(c, 50) as HTMLImageElement[]).map((i) => i.src)).toEqual(marks(["KC", "PHI"])); // stale
    rerender(<Watermarked teams={["BUF", "BAL"]} chart={chart} keyed />);
    const k = chart.current as ChartJS;
    expect(k).not.toBe(c);
    expect((drawn(k, 50) as HTMLImageElement[]).map((i) => i.src)).toEqual(marks(["BUF", "BAL"]));
    expect(live()).toBe(1); // the old chart was destroyed with its component
  });
  test("surface: one court plugin across data updates, painted on every draw", () => {
    const chart: Ref = createRef();
    const court = surface("nba");
    const Shots = ({ n }: { n: number }): ReactElement => (
      <Chart
        ref={chart as never}
        type="scatter"
        width={600}
        height={400}
        data={{ datasets: [{ label: "shots", data: Array.from({ length: n }, (_, i) => ({ x: i, y: i })) }] }}
        options={{ ...BASE, scales: court.scales }}
        plugins={[court.plugin satisfies Plugin]}
      />
    );
    const { rerender } = render(<Shots n={2} />);
    const c = chart.current as ChartJS;
    const transforms = (): number => log(c).filter(([n]) => n === "transform").length;
    expect(transforms()).toBe(2); // the plugin's own transform and drawScene's, once per draw
    log(c).length = 0;
    rerender(<Shots n={5} />);
    expect(chart.current).toBe(c);
    expect(ids(c)).toEqual(["sdvplotSurface"]);
    expect(transforms()).toBe(2);
    expect(c.data.datasets[0]?.data).toHaveLength(5);
  });
});
