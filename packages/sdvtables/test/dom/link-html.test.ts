// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import { createSelection, setWarningHandler } from "@sportsdataverse/sdvplot";
import { brushFilter, linkSelection } from "@sportsdataverse/sdvplot/interact";
import { linkIds } from "@sportsdataverse/sdvplot/plot";
import { beforeAll, expect, test } from "vitest";
import { BKN, type BknShot } from "../../../sdvplot/test/shots/fixture.js";
import { defineTable } from "../../src/define.js";
import { type Table, createTable } from "../../src/engine.js";
import { hydrate, renderHTML } from "../../src/html/index.js";
import { STANDINGS, type Standing } from "../fixtures/standings.js";

beforeAll(() => setWarningHandler(() => {})); // colorPills without a domain warns once per range
const spec = defineTable<Standing>()
  .columns((c) => [c.text("team"), c.int("wins"), c.colorPills("net_epa", { digits: 3 })])
  .rowKey("team")
  .build();
const figure = (): ReturnType<typeof Plot.plot> =>
  Plot.plot({
    width: 640,
    height: 400,
    x: { domain: [0, 17] },
    y: { domain: [-0.2, 0.2] },
    marks: [Plot.dot(STANDINGS, { x: "wins", y: "net_epa", r: 6, render: linkIds(STANDINGS, "team") })],
  });
const mount = (html: string): HTMLElement => {
  document.body.innerHTML = html.replace(/^<link[^>]*>\n/, ""); // no fonts request: unit tests make no network calls
  const el = document.body.querySelector("div.sdvt");
  if (!(el instanceof HTMLElement)) throw new Error("no table root");
  return el;
};
/** hydrate renders on the next animation frame (A24, A35): read the hydrated DOM after one. */
const frame = (): Promise<unknown> => new Promise(requestAnimationFrame);
const over = (el: Element | null | undefined): void => {
  el?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
};
const teamsOf = (el: Element, sel: string): (string | null | undefined)[] =>
  Array.from(el.querySelectorAll(sel)).map((tr) => tr.querySelector('[data-col="team"]')?.textContent);
const hovered = (el: Element): (string | null | undefined)[] => teamsOf(el, "[data-sdv-body] tr.sdvt-hover");
const lit = (root: Element): (string | null)[] =>
  Array.from(root.querySelectorAll(".sdv-hl")).map((e) => e.getAttribute("data-sdv-id"));
/** The fill of one team's net_epa pill (the colour scale's output). */
const fillOf = (el: Element, team: string): string | undefined =>
  Array.from(el.querySelectorAll("[data-sdv-body] tbody tr"))
    .find((tr) => tr.querySelector('[data-col="team"]')?.textContent === team)
    ?.querySelector('[data-col="net_epa"]')
    ?.outerHTML.match(/background-color:\s*(#[0-9a-f]{6})/i)?.[1];
const setup = () => {
  const svg = figure();
  const table = createTable(spec, STANDINGS);
  const el = mount(renderHTML(table));
  hydrate(el, table);
  const store = createSelection<Standing>();
  linkSelection(store, { plot: svg, table });
  return { svg, table, el, store };
};
/** A brush over the top four (KC, LAC, DEN, BUF): the engine moves now, the DOM a frame later (old row 3: LV). */
const brushTop4 = (
  svg: ReturnType<typeof Plot.plot>,
  store: ReturnType<typeof createSelection<Standing>>,
): void =>
  brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" }).move({
    x: [9.5, 16],
    y: [0, 0.2],
  });
const click = (el: Element | null | undefined): void => {
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};
/** A keydown on `target`; true when nothing consumed it (dispatchEvent's return value). */
const press = (target: Element | null | undefined, key: string): boolean =>
  target?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })) ?? true;
const rowAt = (el: Element, i: number): HTMLElement =>
  el.querySelector<HTMLElement>(`[data-sdv-body] tr.sdvt-row[data-row="${i}"]`) as HTMLElement;
/** A hydrated table with no figure or store: the flush is hydrate's own. */
const bare = (pageSize?: number) => {
  const table = createTable(spec, STANDINGS, pageSize === undefined ? {} : { pageSize });
  const el = mount(renderHTML(table));
  hydrate(el, table);
  return { table, el };
};

test("hovering a hydrated table row highlights its dot; leaving the table clears it", () => {
  const { svg, el } = setup();
  over(el.querySelector('[data-sdv-body] tr[data-row="4"] td'));
  expect(lit(svg)).toEqual(["BUF"]);
  el.dispatchEvent(new MouseEvent("mouseleave"));
  expect(svg.classList.contains("sdv-focus")).toBe(false);
});
test("a brush re-renders the hydrated body, and colour pills keep their unbrushed fill (Review Focus 5)", async () => {
  const { svg, el, store } = setup();
  const kc = fillOf(el, "KC");
  expect(kc).toMatch(/^#/);
  brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" }).move({
    x: [9.5, 16],
    y: [0, 0.2],
  });
  await frame();
  expect(el.querySelectorAll("[data-sdv-body] tbody tr")).toHaveLength(4);
  expect(el.querySelectorAll("[data-sdv-body] tr.sdvt-selected")).toHaveLength(4); // brushed rows are selected rows
  // KC's 0.063 is mid-scale over all 8 rows but the bottom of the 4 brushed ones: pinned domains keep its colour
  expect(fillOf(el, "KC")).toBe(kc);
});
test("a figure hover lights the hydrated table row and survives a brush re-render (A29)", async () => {
  const { svg, el, store } = setup();
  over(svg.querySelector('[data-sdv-id="BUF"]'));
  expect(hovered(el)).toEqual(["BUF"]); // a class toggle: no re-render, so at once
  const brush = brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" });
  brush.move({ x: [9.5, 16], y: [0, 0.2] });
  await frame();
  expect(teamsOf(el, "[data-sdv-body] tbody tr")).toEqual(["KC", "LAC", "DEN", "BUF"]); // a NEW body
  expect(hovered(el)).toEqual(["BUF"]);
  svg.dispatchEvent(new MouseEvent("mouseleave"));
  expect(hovered(el)).toEqual([]);
});
test("a hover while a re-render is pending waits for it: never the old body's row at the new row's index", async () => {
  const { svg, el, store } = setup();
  brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" }).move({
    x: [9.5, 16],
    y: [0, 0.2],
  }); // the engine now holds [KC, LAC, DEN, BUF]; the DOM shows all 8 until the next frame
  over(svg.querySelector('[data-sdv-id="BUF"]')); // BUF is new row 3; old row 3 is LV
  expect(hovered(el)).toEqual([]);
  await frame();
  expect(hovered(el)).toEqual(["BUF"]);
});
test("the hydrated table never narrows a two-id store hover: it lights the first and writes nothing back (A29)", async () => {
  const { svg, el, store } = setup();
  store.set({ hover: ["KC", "BUF"] }); // an app's own two-id hover
  expect([...store.getState().hover]).toEqual(["KC", "BUF"]);
  expect(lit(svg)).toEqual(["KC", "BUF"]);
  expect(hovered(el)).toEqual(["KC"]); // a table holds one hover id: the first
  brushTop4(svg, store); // the guard holds across a pending render too
  await frame();
  expect([...store.getState().hover]).toEqual(["KC", "BUF"]);
  expect(hovered(el)).toEqual(["KC"]);
});
test("a table hydrated after the store already holds a hover lights it at once", () => {
  const svg = figure();
  const table = createTable(spec, STANDINGS);
  const el = mount(renderHTML(table));
  const store = createSelection<Standing>();
  store.set({ hover: ["BUF"] });
  linkSelection(store, { plot: svg, table }); // the engine holds BUF before any view listens
  hydrate(el, table);
  expect(hovered(el)).toEqual(["BUF"]);
});
test("a pointer in the frame after a brush reads the current rows: the old row 3 (LV) never reads as BUF", () => {
  const { svg, el, store } = setup();
  brushTop4(svg, store);
  over(el.querySelector('[data-sdv-body] tr[data-row="3"] td')); // the old body's LV: the render runs first
  expect([...store.getState().hover]).toEqual([]); // LV's row is gone, so the pointer names no row
  expect(teamsOf(el, "[data-sdv-body] tbody tr")).toEqual(["KC", "LAC", "DEN", "BUF"]); // already current
  over(el.querySelector('[data-sdv-body] tr[data-row="3"] td'));
  expect([...store.getState().hover]).toEqual(["BUF"]);
});
test("a click in the frame after a brush toggles the right row: the old LV row toggles nothing", () => {
  const { svg, el, store } = setup();
  brushTop4(svg, store); // selects KC, LAC, DEN, BUF
  click(el.querySelector('[data-sdv-body] tr[data-row="3"] td')); // the old body's LV, not BUF
  expect([...store.getState().selected]).toEqual(["KC", "LAC", "DEN", "BUF"]);
  click(el.querySelector('[data-sdv-body] tr[data-row="3"] td')); // the current row 3: BUF
  expect([...store.getState().selected]).toEqual(["KC", "LAC", "DEN"]);
});
test("Enter in the frame after a brush on the old LV row toggles nothing", () => {
  const { svg, el, store } = setup();
  const lv = el.querySelector<HTMLElement>('[data-sdv-body] tr.sdvt-row[data-row="3"]');
  lv?.focus();
  brushTop4(svg, store);
  lv?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  expect([...store.getState().selected]).toEqual(["KC", "LAC", "DEN", "BUF"]); // BUF not toggled off for LV
});
test("Space on a hydrated grid row selects it; the store and the figure follow (A37)", () => {
  const { svg, el, store } = setup();
  const den = el.querySelector<HTMLElement>('[data-sdv-body] tr.sdvt-row[data-row="2"]');
  den?.focus();
  den?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  expect([...store.getState().selected]).toEqual(["DEN"]);
  expect(lit(svg)).toEqual(["DEN"]);
});
test.each([
  ["a sort", undefined, (t: Table<Standing>) => t.setSort("wins", "asc")], // 8 rows and 8: row 3 becomes MIA
  ["a page turn", 4, (t: Table<Standing>) => t.setPage(1)], // 4 rows and 4: row 3 becomes NE
] as const)(
  "%s keeps the row count; in the pending frame the old LV row never reads as another team",
  (_, pageSize, move) => {
    const { table, el } = bare(pageSize);
    const lv = rowAt(el, 3).querySelector("td");
    move(table); // the rows change but their number does not: only the identity check sees it
    over(lv);
    expect(table.getHover()).toBeNull(); // the render ran first: LV's row is gone, so the pointer names no row
    click(lv);
    expect(table.getSelection().size).toBe(0);
  },
);
test("after one rows change has rendered, j twice in one frame still moves twice (each render records its rows)", async () => {
  const { table, el } = bare();
  table.setExternalFilter((r) => r.wins >= 8); // KC LAC DEN BUF MIA
  await frame();
  rowAt(el, 0).focus();
  press(document.activeElement, "j");
  press(document.activeElement, "j"); // a cursor-only render is pending: it keeps the rows, so no flush
  expect(table.state.cursor.row).toBe(2);
});
test("after one rows change has rendered, a click then a hover in one frame both land", async () => {
  const { table, el } = bare();
  table.setExternalFilter((r) => r.wins >= 8);
  await frame();
  click(rowAt(el, 0).querySelector("td")); // KC: a selection-only render is pending
  const den = rowAt(el, 2);
  over(den.querySelector("td"));
  expect(den.isConnected).toBe(true); // not flushed: the row under the pointer stays in place
  expect(table.getHover()).toBe("DEN");
  expect([...table.getSelection()]).toEqual(["KC"]);
});

// Brooklyn's 2025-26 shots (fixtures/shots): no rowKey, so a row's id is its index into BKN, as linkIds stamps
const shotSpec = defineTable<BknShot>()
  .columns((c) => [c.text("game_id"), c.int("shot_distance"), c.int("shot_value"), c.text("shot_result")])
  .build();
const shotRows = (el: Element): string[] =>
  Array.from(el.querySelectorAll("[data-sdv-body] tr.sdvt-hover")).map(
    (tr) => tr.getAttribute("data-row") ?? "",
  );

test("BKN shots through hydrate: a shot hover lights its row at 2 attribute changes a move; brush and click both ways", async () => {
  const svg = Plot.plot({
    x: { domain: [-250, 250] },
    y: { domain: [-52, 418] },
    marks: [Plot.dot(BKN, { x: "x_legacy", y: "y_legacy", r: 2, render: linkIds(BKN) })],
  });
  const table = createTable(shotSpec, BKN, { pageSize: 10 });
  const el = mount(renderHTML(table));
  hydrate(el, table);
  const store = createSelection<BknShot>();
  linkSelection(store, { plot: svg, table });
  // chart → table, hover: shots 0-9 are page 0's rows; moving between two costs 2 attribute writes in the table
  over(svg.querySelector('[data-sdv-id="3"]'));
  expect(shotRows(el)).toEqual(["3"]);
  const body = el.querySelector("[data-sdv-body]") as Element;
  const mo = new MutationObserver(() => {});
  mo.observe(body, { attributes: true, childList: true, subtree: true });
  over(svg.querySelector('[data-sdv-id="7"]'));
  expect(mo.takeRecords().map((r) => r.type)).toEqual(["attributes", "attributes"]);
  expect(shotRows(el)).toEqual(["7"]);
  // chart → table, selection: a brush at the rim (585 shots, measured) pages the table and selects every row shown
  const brush = brushFilter(svg, store, { data: BKN, x: "x_legacy", y: "y_legacy" });
  brush.move({ x: [-40.5, 40.5], y: [-10.5, 40.5] });
  await frame();
  expect(el.querySelector("[data-sdv-page-label]")?.textContent).toBe("Page 1 of 59"); // 585 rows, 10 a page
  expect(el.querySelectorAll("[data-sdv-body] tr.sdvt-selected")).toHaveLength(10);
  brush.move(null);
  await frame();
  // table → chart, selection and hover: a click on row 9 picks shot 9; a hover on row 2 lights shot 2
  el.querySelector('[data-sdv-body] tr[data-row="9"] td')?.dispatchEvent(
    new MouseEvent("click", { bubbles: true }),
  );
  expect([...store.getState().selected]).toEqual(["9"]);
  over(el.querySelector('[data-sdv-body] tr[data-row="2"] td'));
  expect(lit(svg)).toEqual(["2", "9"]); // document order
});
