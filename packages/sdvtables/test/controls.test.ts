// @vitest-environment happy-dom
import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { createTable } from "../src/engine.js";
import { type KeyContext, keyAction, rowIdAt } from "../src/html/controls.js";
import { renderHTML } from "../src/html/index.js";
import { rows, spec } from "./fixtures/engine.js";

beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll();
});

test("M7: rowIdAt reads only this table's body rows; a host row with data-row, the toolbar and the header are null", () => {
  const t = createTable(spec, rows);
  const host = document.createElement("div");
  // a host page table that happens to use data-row, around the sdvtables wrapper
  host.innerHTML = `<table><tbody><tr data-row="3" class="sdvt-row"><td id="outer">x</td></tr></tbody></table>${renderHTML(t, { fonts: false })}`;
  const cell = host.querySelector('[data-sdv-body] tr.sdvt-row[data-row="1"] td');
  expect(rowIdAt(t, cell)).toBe("1"); // no rowKey: the row's index in allRows (LAC)
  expect(rowIdAt(t, host.querySelector("#outer"))).toBeNull();
  expect(rowIdAt(t, host.querySelector(".sdvt-global-filter"))).toBeNull();
  expect(rowIdAt(t, host.querySelector("th"))).toBeNull();
  expect(rowIdAt(t, null)).toBeNull();
});

/** The fixture table's key context: 8 rows in index order; team, wins and net_epa sortable (qb is not). */
const at = (o: Partial<KeyContext> = {}): KeyContext => ({
  focused: 0,
  onRow: true,
  cursor: { row: 0, col: null },
  sorted: null,
  cols: ["team", "wins", "net_epa"],
  order: [0, 1, 2, 3, 4, 5, 6, 7],
  hotkeys: true,
  ...o,
});
test("Task 10: keyAction maps the G19 keys and the grid's arrows, Enter and Space; moves stop at the edges", () => {
  const down = { type: "cursor", row: 1, col: null };
  expect(keyAction("j", at())).toEqual(down);
  expect(keyAction("ArrowDown", at())).toEqual(down);
  expect(keyAction("k", at())).toEqual({ type: "cursor", row: 0, col: null }); // top edge
  expect(keyAction("j", at({ focused: 7 }))).toEqual({ type: "cursor", row: 7, col: null }); // bottom edge
  // from the header, toolbar or pager: enter the grid at the cursor row
  expect(keyAction("j", at({ focused: null, onRow: false, cursor: { row: 4, col: "wins" } }))).toEqual({
    type: "cursor",
    row: 4,
    col: "wins",
  });
  // groupBy shows the page's rows in group order: j goes to the next row SHOWN
  const grouped = [0, 2, 3, 6, 1, 4, 5, 7]; // West: KC LAC DEN LV, then East: BUF MIA NYJ NE (wins desc)
  expect(keyAction("j", at({ order: grouped }))).toEqual({ type: "cursor", row: 2, col: null });
  expect(keyAction("j", at({ order: grouped, focused: 2 }))).toEqual({ type: "cursor", row: 3, col: null });
  expect(keyAction("k", at({ order: grouped, focused: 1 }))).toEqual({ type: "cursor", row: 6, col: null });
  expect(keyAction("l", at())).toEqual({ type: "cursor", row: 0, col: "wins" }); // from the first sortable column
  expect(keyAction("ArrowRight", at({ sorted: "wins", focused: 3 }))).toEqual({
    type: "cursor",
    row: 3,
    col: "net_epa",
  }); // from the sorted column
  expect(keyAction("h", at({ cursor: { row: 0, col: "team" } }))).toEqual({
    type: "cursor",
    row: 0,
    col: "team",
  });
  expect(keyAction("s", at())).toEqual({ type: "sort", col: "team" });
  expect(keyAction("s", at({ cursor: { row: 0, col: "net_epa" }, sorted: "wins" }))).toEqual({
    type: "sort",
    col: "net_epa",
  });
  // a cursor column that is no longer shown and sortable falls back to the sorted one
  expect(keyAction("s", at({ cursor: { row: 0, col: "qb" }, sorted: "wins" }))).toEqual({
    type: "sort",
    col: "wins",
  });
  expect(keyAction("/", at())).toEqual({ type: "search" });
  expect(keyAction("Enter", at({ focused: 2 }))).toEqual({ type: "toggle", row: 2 });
  expect(keyAction(" ", at({ focused: 2 }))).toEqual({ type: "toggle", row: 2 });
  expect(keyAction("Enter", at({ onRow: false }))).toBeNull(); // Enter on a link or button in a row is that control's
  for (const key of ["x", "J", "Tab", "Escape", "constructor", "toString"])
    expect(keyAction(key, at())).toBeNull();
  expect(keyAction("s", at({ cols: [] }))).toBeNull(); // nothing sortable
  expect(keyAction("j", at({ focused: null, onRow: false, order: [] }))).toBeNull(); // no rows
});
test("Task 10: hotkeys: false turns off j/k/h/l/s and /, never the arrows, Enter or Space", () => {
  const off = at({ hotkeys: false });
  for (const key of ["j", "k", "h", "l", "s", "/"]) expect(keyAction(key, off)).toBeNull();
  expect(keyAction("ArrowDown", off)).toEqual({ type: "cursor", row: 1, col: null });
  expect(keyAction("ArrowRight", off)).toEqual({ type: "cursor", row: 0, col: "wins" });
  expect(keyAction("Enter", off)).toEqual({ type: "toggle", row: 0 });
  expect(keyAction(" ", off)).toEqual({ type: "toggle", row: 0 });
});
