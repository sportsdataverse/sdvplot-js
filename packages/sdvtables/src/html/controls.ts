import { type Table, type TableCursor, nextSortDir } from "../engine.js";

// a body row of THIS table's block (a host page's or an outer table's tr[data-row] is never one)
const BODY_ROW = "[data-sdv-body] tr.sdvt-row[data-row]";

/** J31: the engine id of the body row an event landed in; null for a header, toolbar, pager, group row, or outside the table. */
export function rowIdAt<Row>(table: Table<Row>, target: EventTarget | null): string | null {
  // scoped to the body block: a host page or outer table with its own tr[data-row] is never read as one of ours
  const tr = target instanceof Element ? target.closest(BODY_ROW) : null;
  const row = tr === null ? undefined : table.rows[Number(tr.getAttribute("data-row"))];
  const id = row === undefined ? "" : table.rowId(row);
  return id === "" ? null : id;
}

/** A click anywhere inside the table wrapper — shared by hydrate and `<SdvTable/>`. */
export function handleClick<Row>(table: Table<Row>, target: EventTarget | null): void {
  const el =
    target instanceof Element ? target.closest<HTMLElement>("[data-sdv-sort],[data-sdv-page]") : null;
  if (!el) {
    // J31: a click on a body row toggles its id in the selection
    const id = rowIdAt(table, target);
    if (id === null) return;
    const next = new Set(table.getSelection());
    if (!next.delete(id)) next.add(id);
    table.setSelection(next);
    return;
  }
  if (el.getAttribute("aria-disabled") === "true") return; // M1: an edge pager button keeps focus and does nothing
  const sortCol = el.getAttribute("data-sdv-sort");
  const page = el.getAttribute("data-sdv-page");
  if (sortCol !== null) table.setSort(sortCol, nextSortDir(table.state.sort, sortCol));
  else if (page === "prev") table.setPage(table.state.page - 1);
  else if (page === "next") table.setPage(table.state.page + 1);
}

/** An `input` event anywhere inside the wrapper. */
export function handleInput<Row>(table: Table<Row>, target: EventTarget | null): void {
  if (!(target instanceof HTMLInputElement)) return;
  const col = target.getAttribute("data-sdv-filter");
  if (col !== null) table.setFilter(col, target.value === "" ? null : target.value);
  else if (target.hasAttribute("data-sdv-global-filter")) table.setGlobalFilter(target.value);
}

/** J31: `mouseover` / `mouseleave` inside the wrapper → the engine's hover event (null off a body row). */
export function handleHover<Row>(table: Table<Row>, target: EventTarget | null): void {
  table.setHover(rowIdAt(table, target));
}

// M5: the attributes that name a control; a control rebuilt under focus gets focus back by name
const CONTROLS = ["data-sdv-sort", "data-sdv-filter", "data-sdv-global-filter", "data-sdv-page"] as const;
const FOCUSABLE = "a[href],button,input,select,textarea,[tabindex]";

/**
 * Remembers what has focus inside `el` by names a re-render keeps: a control by its `data-sdv-*` attribute (and an
 * input's caret), a focusable element inside a rendered cell by row, column key and its index among that cell's
 * focusables. Call it before a re-render; the returned function, called after it, moves focus to the rebuilt element
 * when the re-render replaced the focused one (shadow-root mounts included), and does nothing otherwise. Shared by
 * hydrate and `<SdvTable/>`.
 */
export function captureFocus(el: Element): () => void {
  const root = el.getRootNode() as Document | ShadowRoot;
  const focused = root.activeElement ?? el.ownerDocument.activeElement;
  if (focused === null || !el.contains(focused)) return () => {};
  const name = CONTROLS.find((a) => focused.hasAttribute(a));
  const value = name === undefined ? null : focused.getAttribute(name);
  const caret =
    focused instanceof HTMLInputElement
      ? { start: focused.selectionStart, end: focused.selectionEnd }
      : undefined;
  const td = name === undefined ? focused.closest("[data-sdv-body] tr[data-row] td[data-col]") : null;
  const cellAt = td
    ? {
        row: td.parentElement?.getAttribute("data-row"),
        col: td.getAttribute("data-col"),
        n: Array.from(td.querySelectorAll(FOCUSABLE)).indexOf(focused),
      }
    : undefined;
  // Task 10: the focused body row itself (the grid's roving tab stop) comes back by its data-row
  const row = name === undefined && focused.matches(BODY_ROW) ? focused.getAttribute("data-row") : null;
  return () => {
    if (el.contains(focused)) return;
    if (name !== undefined) {
      const next = Array.from(el.querySelectorAll<HTMLElement>(`[${name}]`)).find(
        (n) => n.getAttribute(name) === value,
      );
      next?.focus();
      if (next instanceof HTMLInputElement && caret?.start != null && caret.end != null)
        next.setSelectionRange(caret.start, caret.end);
    } else if (row !== null) {
      Array.from(el.querySelectorAll<HTMLElement>(BODY_ROW))
        .find((r) => r.getAttribute("data-row") === row)
        ?.focus();
    } else if (cellAt && cellAt.n >= 0) {
      const tds = Array.from(el.querySelectorAll("[data-sdv-body] tr[data-row]"))
        .find((r) => r.getAttribute("data-row") === cellAt.row)
        ?.querySelectorAll("td[data-col]");
      const cell = Array.from(tds ?? []).find((c) => c.getAttribute("data-col") === cellAt.col);
      cell?.querySelectorAll<HTMLElement>(FOCUSABLE)[cellAt.n]?.focus();
    }
  };
}

/** Task 10: what a key means to an interactive table (see {@link keyAction}). */
export type KeyAction =
  | { readonly type: "cursor"; readonly row: number; readonly col: string | null }
  | { readonly type: "sort"; readonly col: string }
  | { readonly type: "search" }
  | { readonly type: "toggle"; readonly row: number };

/** Task 10: everything {@link keyAction} reads; {@link handleKeydown} gathers it from the engine and the DOM. */
export interface KeyContext {
  /** the `data-row` of the body row the key landed in, or null (toolbar, header, pager) */
  readonly focused: number | null;
  /**
   * the key landed on that body row itself, not on a link or button inside it (that control keeps its Enter, Space
   * and left/right keys)
   */
  readonly onRow: boolean;
  /** the engine's cursor (`table.state.cursor`) */
  readonly cursor: TableCursor;
  /** the sorted column (`table.state.sort?.col`), or null */
  readonly sorted: string | null;
  /** the shown sortable columns in header order: the `data-sdv-sort` buttons */
  readonly cols: readonly string[];
  /** the page's body rows' `data-row` values in display order (`groupBy` reorders them) */
  readonly order: readonly number[];
  /** `spec.interactive.hotkeys !== false`: the letter keys and `/` are on */
  readonly hotkeys: boolean;
}

type Move = "down" | "up" | "left" | "right" | "sort" | "search" | "toggle";
// a Map, not an object literal: KEYS["constructor"] would be Object.prototype's and slip past the undefined check
const KEYS: ReadonlyMap<string, Move> = new Map([
  ["j", "down"],
  ["k", "up"],
  ["h", "left"],
  ["l", "right"],
  ["s", "sort"],
  ["/", "search"],
  ["ArrowDown", "down"],
  ["ArrowUp", "up"],
  ["ArrowLeft", "left"],
  ["ArrowRight", "right"],
  ["Enter", "toggle"],
  [" ", "toggle"],
]);
// G19's keys, which `hotkeys: false` turns off; the arrows, Enter and Space are the grid's own keyboard model
const LETTERS: ReadonlySet<string> = new Set(["j", "k", "h", "l", "s", "/"]);
const clamp = (i: number, n: number): number => Math.max(0, Math.min(i, n - 1));

/**
 * Task 10 (A45, G19): the action a keydown means, or null when it means nothing here. Pure. `j`/`k` (and the down and
 * up arrows) move the cursor row in display order, and enter the grid at the cursor row when the key came from
 * outside the rows; `h`/`l` (left and right arrows) move the cursor column over the shown sortable columns, starting
 * from the cursor column, else the sorted one, else the first; `s` sorts that column; `/` goes to the search box;
 * Enter and Space toggle the selection of the row the key landed on. Moves stop at the edges: `j`/`k` stop at the
 * first and last row of the CURRENT page and never turn it (the pager does), `h`/`l` at the first and last sortable
 * column. A left/right key that lands on a link or button inside a row (`focused` set, `onRow` false) is that
 * control's: null.
 *
 * @example
 * ```ts
 * import { keyAction } from "@sportsdataverse/sdvtables/html";
 *
 * // `l` on the first row of a table sorted by wins: the cursor column moves right, to net_epa
 * keyAction("l", {
 *   focused: 0,
 *   onRow: true,
 *   cursor: { row: 0, col: null },
 *   sorted: "wins",
 *   cols: ["team", "wins", "net_epa"],
 *   order: [0, 1, 2],
 *   hotkeys: true,
 * });
 * ```
 */
export function keyAction(key: string, k: KeyContext): KeyAction | null {
  const what = KEYS.get(key);
  if (what === undefined || (!k.hotkeys && LETTERS.has(key))) return null;
  const shown = (c: string | null): c is string => c !== null && k.cols.includes(c);
  const col = shown(k.cursor.col) ? k.cursor.col : shown(k.sorted) ? k.sorted : (k.cols[0] ?? null);
  const row = k.focused ?? k.cursor.row;
  switch (what) {
    case "down":
    case "up": {
      const at = k.order.indexOf(row);
      if (at < 0) return null;
      const next = k.focused === null ? row : k.order[clamp(at + (what === "down" ? 1 : -1), k.order.length)];
      return next === undefined ? null : { type: "cursor", row: next, col: k.cursor.col };
    }
    case "left":
    case "right": {
      if (k.focused !== null && !k.onRow) return null; // fix 1: a link or button in a cell keeps its own left/right
      const step = what === "right" ? 1 : -1;
      const next = col === null ? undefined : k.cols[clamp(k.cols.indexOf(col) + step, k.cols.length)];
      return next === undefined ? null : { type: "cursor", row, col: next };
    }
    case "sort":
      return col === null ? null : { type: "sort", col };
    case "search":
      return { type: "search" };
    case "toggle":
      return k.onRow && k.focused !== null ? { type: "toggle", row: k.focused } : null;
  }
}

// typing in a field is never a hotkey (A45); contenteditable="false" is not a field
const TEXT_FIELD = 'input,textarea,select,[contenteditable]:not([contenteditable="false"])';

/**
 * Task 10 (A45, A48): a keydown anywhere inside `root`, the table wrapper; shared by hydrate and `<SdvTable/>`.
 * Ignored with Ctrl, Meta or Alt held, during IME composition, or when it comes from a text field (input, textarea,
 * select, contenteditable). Otherwise {@link keyAction} decides, and a key that acts is consumed (`preventDefault`):
 * a cursor move focuses the destination row BEFORE the engine re-renders, so the re-render's focus restore keeps it
 * there; `s` and Enter/Space go through {@link handleClick} on the column's sort button or on the row, exactly as a
 * click, once per press (a held key's repeats are consumed but toggle nothing); `/` focuses the search box, and passes
 * through to the browser (quick-find) when `root` has none. `spec.interactive.hotkeys: false` leaves only the arrows,
 * Enter and Space.
 *
 * @example
 * ```ts
 * import { createTable, defineTable } from "@sportsdataverse/sdvtables";
 * import { handleKeydown, renderHTML } from "@sportsdataverse/sdvtables/html";
 *
 * // 2024 AFC: Kansas City 15 wins, Buffalo 13
 * const spec = defineTable<{ team: string; wins: number }>()
 *   .columns((c) => [c.text("team"), c.int("wins")])
 *   .build();
 * const table = createTable(spec, [
 *   { team: "KC", wins: 15 },
 *   { team: "BUF", wins: 13 },
 * ]);
 * const root = document.createElement("div");
 * root.innerHTML = renderHTML(table, { fonts: false });
 * root.addEventListener("keydown", (e) => handleKeydown(table, root, e));
 * root
 *   .querySelector("[data-sdv-body] tr[data-row]")
 *   ?.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true, cancelable: true }));
 * table.state.cursor; // { row: 1, col: null }
 * ```
 */
export function handleKeydown<Row>(table: Table<Row>, root: Element, e: KeyboardEvent): void {
  const t = e.target;
  if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!(t instanceof Element) || t.closest(TEXT_FIELD) !== null) return;
  const rows = Array.from(root.querySelectorAll<HTMLElement>(BODY_ROW));
  const sorts = Array.from(root.querySelectorAll<HTMLElement>("[data-sdv-body] [data-sdv-sort]"));
  const near = t.closest(BODY_ROW);
  const rowEl = near !== null && root.contains(near) ? near : null; // never an outer table's row
  const s = table.state;
  const action = keyAction(e.key, {
    focused: rowEl === null ? null : Number(rowEl.getAttribute("data-row")),
    onRow: rowEl === t,
    cursor: s.cursor,
    sorted: s.sort?.col ?? null,
    cols: sorts.map((b) => b.getAttribute("data-sdv-sort") ?? ""),
    order: rows.map((r) => Number(r.getAttribute("data-row"))),
    hotkeys: table.spec.interactive?.hotkeys !== false,
  });
  const box = action?.type === "search" ? root.querySelector<HTMLElement>("[data-sdv-global-filter]") : null;
  if (action === null || (action.type === "search" && box === null)) return; // fix 1 (I1): no box, `/` is the browser's
  e.preventDefault();
  if (action.type === "search") box?.focus();
  else if (action.type === "sort")
    handleClick(table, sorts.find((b) => b.getAttribute("data-sdv-sort") === action.col) ?? null);
  else if (action.type === "toggle") {
    if (!e.repeat) handleClick(table, rowEl); // fix 1: holding Enter or Space toggles once, not at key-repeat rate
  } else {
    // focus first: hydrate and <SdvTable/> restore focus to the focused row's data-row after the re-render
    rows.find((r) => r.getAttribute("data-row") === String(action.row))?.focus();
    table.setCursor(action.row, action.col);
  }
}
