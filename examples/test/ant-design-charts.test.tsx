import { Column, Line, Scatter } from "@ant-design/plots";
import type { Chart } from "@antv/g2";
import { type Canvas, createCanvas } from "@napi-rs/canvas";
import { loadLeague, logoUrlSync, resetWarnings } from "@sportsdataverse/sdvplot";
import { axisLogos, drawnMarks, logoMark, teamColorScale } from "@sportsdataverse/sdvplot/g2";
import { type ReactElement, act, cloneElement } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { AFC_WEEKS_2024, STANDINGS } from "../src/data.js";

/**
 * sdvplot/g2's pieces through Ant Design Charts 2.6 (`@ant-design/plots`), in jsdom with G2's canvas renderer on
 * @napi-rs/canvas: a `<Column>`, `<Scatter>` and `<Line>` config takes the colour scale, the axis logos and the logo
 * marks (in `annotations`) as they are, and G2 draws them where they belong, read back from G2's own scene graph.
 */
const TEAMS = ["KC", "LAC", "DEN", "LV"];
const ROWS = TEAMS.map((team) => {
  const s = STANDINGS.find((r) => r.team === team);
  if (s === undefined) throw new Error(`${team} is not in STANDINGS`);
  return { team, wins: s.wins, pf: s.pf, pa: s.pa };
});
const proto = HTMLCanvasElement.prototype;
const saved = Object.getOwnPropertyDescriptor(proto, "getContext");
let host: HTMLDivElement | undefined;

beforeAll(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const backing = new WeakMap<HTMLCanvasElement, Canvas>();
  Object.defineProperty(proto, "getContext", {
    configurable: true,
    value(this: HTMLCanvasElement, kind: "2d") {
      const c = backing.get(this) ?? createCanvas(this.width || 300, this.height || 150);
      backing.set(this, c);
      return c.getContext(kind);
    },
  });
  await loadLeague("nfl");
});
afterAll(() => {
  if (saved !== undefined) Object.defineProperty(proto, "getContext", saved);
});
afterEach(() => {
  host?.remove();
  resetWarnings();
});

interface GNode {
  nodeName: string;
  markType?: string;
  style: Record<string, unknown>;
  getBounds(): { center: number[] };
}
/** Mount `element`, wait for G2 to finish drawing, and hand back a query over its scene graph. */
async function mount(element: ReactElement<{ onReady?: (p: { chart: Chart }) => void }>) {
  host = document.body.appendChild(document.createElement("div"));
  host.style.width = "480px";
  const root = createRoot(host);
  let chart: Chart | undefined;
  const done = new Promise<void>((resolve) => {
    const onReady = (p: { chart: Chart }) => {
      chart = p.chart;
      p.chart.on("afterrender", () => resolve());
    };
    act(() => root.render(cloneElement(element, { onReady })));
  });
  await done;
  const doc = chart?.getContext().canvas?.document;
  if (doc === undefined) throw new Error("no G2 canvas");
  const find = (sel: string) => doc.querySelectorAll(sel) as unknown as GNode[];
  const marks = (type: string) => find(".element").filter((e) => e.markType === type);
  return { root, find, marks };
}
const centre = (n: GNode): number[] =>
  n
    .getBounds()
    .center.slice(0, 2)
    .map((v) => Math.round(v * 100) / 100);

test("<Scatter>: the logo marks in `annotations` sit on their own points, unchanged by the plot's fields", async () => {
  const logos = logoMark(ROWS, { x: "pf", y: "pa", team: "team", league: "nfl", size: 30 });
  const before = JSON.stringify(drawnMarks(logos));
  const color = teamColorScale("nfl", TEAMS);
  const { root, marks } = await mount(
    <Scatter
      data={ROWS}
      xField="pf"
      yField="pa"
      colorField="team"
      width={480}
      height={320}
      scale={{ color }}
      annotations={[logos]}
      animate={false}
    />,
  );
  const images = marks("image");
  expect(images.map((i) => i.style.src)).toEqual(TEAMS.map((t) => logoUrlSync(t, "nfl")));
  expect(images.map((i) => [i.style.width, i.style.height])).toEqual(TEAMS.map(() => [30, 30]));
  expect(images.map(centre)).toEqual(marks("point").map(centre));
  // the team colours reach the points through the plot's own scale option
  expect(marks("point").map((p) => p.style.stroke)).toEqual(color.range); // a hollow point: its ring
  expect(JSON.stringify(drawnMarks(logos))).toBe(before); // Ant Design Charts left the mark as it was
  act(() => root.unmount());
});

test("<Column>: team-coloured columns and the axis logos (G2's labelRender) through the plot's `axis`", async () => {
  const color = teamColorScale("nfl", TEAMS);
  const { root, find, marks } = await mount(
    <Column
      data={ROWS}
      xField="team"
      yField="wins"
      colorField="team"
      width={480}
      height={320}
      scale={{ color }}
      axis={{ x: { ...axisLogos({ league: "nfl", size: 26 }), title: false } }}
      legend={false}
      animate={false}
    />,
  );
  expect(marks("interval").map((b) => b.style.fill)).toEqual(color.range);
  const labels = find("html").map((h) => String(h.style.innerHTML));
  expect(labels).toHaveLength(4);
  TEAMS.forEach((t, i) => expect(labels[i]).toContain(`src="${logoUrlSync(t, "nfl")}"`));
  act(() => root.unmount());
});

test("<Line>: dark-mode team colours on the lines and a logo on each line's last point", async () => {
  const rows = TEAMS.flatMap((team) => {
    const t = AFC_WEEKS_2024.find((w) => w.team === team);
    if (t === undefined) throw new Error(`${team} is not in AFC_WEEKS_2024`);
    return t.margins.map((_, i) => ({
      team,
      week: i + 1,
      margin: t.margins.slice(0, i + 1).reduce<number>((sum, m) => sum + (m ?? 0), 0),
    }));
  });
  const ends = rows.filter((r) => r.week === 18);
  const color = teamColorScale("nfl", TEAMS, { background: "#141414" });
  const { root, marks } = await mount(
    <Line
      data={rows}
      xField="week"
      yField="margin"
      colorField="team"
      width={480}
      height={320}
      theme="dark"
      scale={{ color }}
      annotations={[logoMark(ends, { x: "week", y: "margin", team: "team", league: "nfl" })]}
      animate={false}
    />,
  );
  const lines = marks("line");
  expect(lines.map((l) => l.style.stroke)).toEqual(color.range);
  // each logo is centred on its line's week-18 point: the right end of the line's path
  const images = marks("image");
  expect(images).toHaveLength(4);
  const lastPoint = (l: GNode): number[] => {
    const d = (l as unknown as { __data__: { points: number[][] } }).__data__.points;
    return d[d.length - 1] as number[];
  };
  const imageAt = images.map(
    (i) => (i as unknown as { __data__: { points: number[][] } }).__data__.points[0],
  );
  expect(imageAt).toEqual(lines.map(lastPoint));
  act(() => root.unmount());
});
