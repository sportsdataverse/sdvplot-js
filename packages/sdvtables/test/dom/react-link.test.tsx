// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { type SelectionStore, createSelection } from "@sportsdataverse/sdvplot";
import { brushFilter, linkSelection } from "@sportsdataverse/sdvplot/interact";
import { linkIds } from "@sportsdataverse/sdvplot/plot";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ReactElement, useEffect } from "react";
import { afterEach, expect, test } from "vitest";
import { SdvTable, useTable } from "../../src/react/index.js";
import { spec } from "../fixtures/engine.js";
import { STANDINGS, type Standing } from "../fixtures/standings.js";

afterEach(cleanup); // no vitest globals, so RTL cannot register its own cleanup
const keyed = { ...spec, rowKey: "team" } satisfies typeof spec;
function Linked({ store, plot }: { store: SelectionStore<Standing>; plot?: Element }): ReactElement {
  const { table } = useTable(keyed, STANDINGS);
  useEffect(() => linkSelection(store, { table }), [store, table]);
  useEffect(() => (plot ? linkSelection(store, { plot }) : undefined), [store, plot]);
  return <SdvTable spec={keyed} rows={STANDINGS} table={table} interactive />;
}
const figure = (): ReturnType<typeof Plot.plot> =>
  Plot.plot({
    width: 640,
    height: 400,
    x: { domain: [0, 17] },
    y: { domain: [-0.2, 0.2] },
    marks: [Plot.dot(STANDINGS, { x: "wins", y: "net_epa", r: 6, render: linkIds(STANDINGS, "team") })],
  });
const hovered = (): (string | null | undefined)[] =>
  Array.from(document.querySelectorAll("[data-sdv-body] tr.sdvt-hover")).map(
    (tr) => tr.querySelector('[data-col="team"]')?.textContent,
  );
const lit = (root: Element): (string | null)[] =>
  Array.from(root.querySelectorAll(".sdv-hl")).map((e) => e.getAttribute("data-sdv-id"));

test("useTable + linkSelection + <SdvTable table/>: row hover and click reach the store; the store filters the table", () => {
  const store = createSelection<Standing>();
  render(<Linked store={store} />);
  const kc = screen.getByText("KC").closest("tr");
  if (!kc) throw new Error("no KC row");
  fireEvent.mouseOver(kc);
  expect([...store.getState().hover]).toEqual(["KC"]);
  fireEvent.click(kc);
  expect([...store.getState().selected]).toEqual(["KC"]);
  expect(document.querySelector('tr.sdvt-selected [data-col="team"]')?.textContent).toBe("KC");
  act(() => store.set({ predicate: (r) => r.wins >= 13 }));
  expect(document.querySelectorAll("[data-sdv-body] tbody tr")).toHaveLength(2); // KC 15, BUF 13
});
test("React: a figure hover lights the table row and survives a brush re-render (A29)", () => {
  const store = createSelection<Standing>();
  const svg = figure();
  render(<Linked store={store} plot={svg} />);
  act(() => {
    svg.querySelector('[data-sdv-id="BUF"]')?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  });
  expect(hovered()).toEqual(["BUF"]);
  const body = document.querySelector("[data-sdv-body] tbody");
  act(() => {
    brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" }).move({
      x: [9.5, 16],
      y: [0, 0.2],
    });
  });
  expect(document.querySelector("[data-sdv-body] tbody")).not.toBe(body); // React rebuilt the body
  expect(document.querySelectorAll("[data-sdv-body] tbody tr")).toHaveLength(4);
  expect(hovered()).toEqual(["BUF"]);
  act(() => {
    svg.dispatchEvent(new MouseEvent("mouseleave"));
  });
  expect(hovered()).toEqual([]);
});
test("React: <SdvTable/> never narrows a two-id store hover: it lights the first and writes nothing back (A29)", () => {
  const store = createSelection<Standing>();
  const svg = figure();
  render(<Linked store={store} plot={svg} />);
  act(() => store.set({ hover: ["KC", "BUF"] }));
  expect([...store.getState().hover]).toEqual(["KC", "BUF"]);
  expect(lit(svg)).toEqual(["KC", "BUF"]);
  expect(hovered()).toEqual(["KC"]); // a table holds one hover id: the first
  act(() => {
    brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" }).move({
      x: [9.5, 16],
      y: [0, 0.2],
    });
  });
  expect([...store.getState().hover]).toEqual(["KC", "BUF"]);
  expect(hovered()).toEqual(["KC"]);
});
