import type { ComponentType } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

// docs/src/components/Live.tsx in jsdom (Docusaurus' own modules are stubs: vitest.config.ts), drawing through the real
// draw() with a library that adds its box and then waits until the test settles it (as plotly.ts adds its figure box).
const gates = vi.hoisted(() => ({}) as Record<string, { resolve: () => void; reject: (e: Error) => void }>);
vi.mock("../src/draw/vega.js", () => ({
  default: async (el: HTMLElement, s: { spec: { id: string } }) => {
    const box = el.appendChild(document.createElement("div"));
    box.dataset.chart = s.spec.id;
    await new Promise<void>((resolve, reject) => {
      gates[s.spec.id] = { resolve, reject };
    });
    return () => box.remove();
  },
}));
vi.mock("@sportsdataverse/examples/browser", async () => ({
  draw: (await import("../src/draw/index.js")).draw,
  BROWSER: Object.fromEntries(
    ["a", "b"].map((id) => [`t/${id}`, async () => ({ browser: { lib: "vega", spec: { id } } })]),
  ),
}));
// A string, not a literal: the examples' tsc stays out of the docs (its @docusaurus and @theme aliases)
const LIVE: string = "../../docs/src/components/Live.tsx";

const settled = (id: string) =>
  vi.waitFor(() => {
    if (gates[id] === undefined) throw new Error(`${id} has not started drawing`);
  });

test("a cancelled drawing that fails late leaves the newer chart, and nothing of its own", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const Live = (
    (await import(/* @vite-ignore */ LIVE)) as { default: ComponentType<Record<string, unknown>> }
  ).default;
  const props = { kind: "value", code: "", lang: "ts", title: "t", browser: true, markup: "<p>static</p>" };
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<Live id="t/a" {...props} />));
  await act(() => settled("a"));
  // The id changes on the mounted figure: a's effect is cancelled while its library is still drawing, b's starts
  await act(async () => root.render(<Live id="t/b" {...props} />));
  await act(() => settled("b"));
  await act(async () => gates.b?.resolve());
  await act(async () => gates.a?.reject(new Error("a failed late")));
  const charts = [...container.querySelectorAll<HTMLElement>(".sdv-live-output [data-chart]")];
  expect(
    charts.map((c) => c.dataset.chart),
    "b's chart, and no box left from a",
  ).toEqual(["b"]);
  expect(container.querySelector('[role="alert"]'), "a cancelled drawing reports nothing").toBeNull();
  expect(container.querySelector(".sdv-live-static"), "b replaced the static copy").toBeNull();
  await act(async () => root.unmount());
});
