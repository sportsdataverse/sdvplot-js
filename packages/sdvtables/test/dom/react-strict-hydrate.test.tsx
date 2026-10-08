// @vitest-environment jsdom
import { type SelectionStore, createSelection } from "@sportsdataverse/sdvplot";
import { linkSelection } from "@sportsdataverse/sdvplot/interact";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { type ReactElement, StrictMode, useEffect, useRef } from "react";
import { afterEach, expect, test } from "vitest";
import { type Table, createTable } from "../../src/engine.js";
import { hydrate, renderHTML } from "../../src/html/index.js";
import { spec } from "../fixtures/engine.js";
import { STANDINGS, type Standing } from "../fixtures/standings.js";

afterEach(cleanup); // no vitest globals, so RTL cannot register its own cleanup
const keyed = { ...spec, rowKey: "team" } satisfies typeof spec;
/** An island: server markup that effects hydrate and link to a store, as a page without <SdvTable/> does. */
function Island(p: { store: SelectionStore<Standing>; table: Table<Standing>; html: string }): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => hydrate(ref.current?.querySelector("div.sdvt") as Element, p.table), [p.table]);
  useEffect(() => linkSelection(p.store, { table: p.table }), [p.store, p.table]);
  // biome-ignore lint/security/noDangerouslySetInnerHtml: the island's server markup, renderHTML's escaped output
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: p.html }} />;
}
/**
 * Mounts the island under StrictMode against a store that already holds `state`. The effects run hydrate, link (a
 * render owed), both cleanups (the owed render dropped), hydrate, link (a no-op: the engine already holds the state).
 */
function mountStrict(state: Parameters<SelectionStore<Standing>["set"]>[0]): Table<Standing> {
  const store = createSelection<Standing>();
  store.set(state);
  const table = createTable(keyed, STANDINGS);
  const html = renderHTML(table, { fonts: false }); // the server's markup: all 8 rows, as the engine starts
  render(
    <StrictMode>
      <Island store={store} table={table} html={html} />
    </StrictMode>,
  );
  return table;
}
const teams = (sel: string): (string | null | undefined)[] =>
  Array.from(document.querySelectorAll(sel), (tr) => tr.querySelector("td")?.textContent);
const frame = (): Promise<unknown> => act(() => new Promise(requestAnimationFrame));

const clickRow3 = (): void => {
  fireEvent.click(document.querySelector('[data-sdv-body] tr[data-row="3"] td') as Element);
};

test("StrictMode: hydrate + linkSelection effects against a store holding a brush show the brushed rows", async () => {
  const table = mountStrict({ predicate: (r) => r.wins >= 10 }); // the engine holds KC LAC DEN BUF
  await frame();
  const body = teams("[data-sdv-body] tbody tr");
  clickRow3();
  expect({ body, clicked: body[3], selected: [...table.getSelection()] }).toEqual({
    body: ["KC", "LAC", "DEN", "BUF"],
    clicked: "BUF", // the row shown at 3 is the row selected
    selected: ["BUF"],
  });
});
test("StrictMode, brush: a click before the redraw frame redraws first, so the SSR markup's LV row never selects BUF", () => {
  const table = mountStrict({ predicate: (r) => r.wins >= 10 });
  const clicked = teams("[data-sdv-body] tbody tr")[3]; // the SSR markup's row 3, until the frame
  clickRow3();
  expect({ clicked, selected: [...table.getSelection()] }).toEqual({ clicked: "LV", selected: [] });
});
test("StrictMode: hydrate + linkSelection effects against a store holding a selection show BUF selected", async () => {
  const table = mountStrict({ selected: new Set(["BUF"]) });
  await frame();
  expect([...table.getSelection()]).toEqual(["BUF"]);
  expect({
    shown: teams("[data-sdv-body] tr.sdvt-selected"),
    aria: document.querySelector('[data-sdv-body] tr[data-row="4"]')?.getAttribute("aria-selected"), // BUF
  }).toEqual({ shown: ["BUF"], aria: "true" });
});
test("StrictMode, brush holding no team: a click before the redraw frame still redraws, so no SSR row stays (Copilot)", () => {
  const table = mountStrict({ predicate: (r) => r.wins >= 16 }); // no 2024 AFC team won 16: the engine holds 0 rows
  expect(table.rows).toHaveLength(0);
  expect(teams("[data-sdv-body] tbody tr[data-row]")).toHaveLength(8); // the SSR markup's rows, until the frame
  clickRow3();
  const shown = teams("[data-sdv-body] tbody tr[data-row]");
  expect({ shown, selected: [...table.getSelection()] }).toEqual({ shown: [], selected: [] });
});
