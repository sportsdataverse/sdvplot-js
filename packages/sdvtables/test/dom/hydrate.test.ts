import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
// @vitest-environment happy-dom
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { defineTable } from "../../src/define.js";
import { createTable } from "../../src/engine.js";
import { hydrate, renderHTML } from "../../src/html/index.js";
import { LV_OCONNELL, many, rows, spec } from "../fixtures/engine.js";
import { STANDINGS, type Standing } from "../fixtures/standings.js";

beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function mount(html: string): HTMLElement {
  // without the fonts <link>: happy-dom would fetch the stylesheet, and unit tests make no network calls
  document.body.innerHTML = html.replace(/^<link[^>]*>\n/, "");
  const el = document.body.querySelector("div.sdvt");
  if (!(el instanceof HTMLElement)) throw new Error("no root");
  return el;
}
const firstTeam = (el: Element): string | null | undefined =>
  el.querySelector("[data-sdv-body] tbody tr td")?.textContent;
const body = (el: Element): string => el.querySelector("[data-sdv-body]")?.innerHTML ?? "";
/** M6: hydrate renders on the next animation frame; this resolves after it (frames run in request order). */
const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
/** Counts writes to `node.innerHTML`, i.e. hydrate's table-block renders. */
function countWrites(node: Element): { n: number } {
  let proto: object | null = Object.getPrototypeOf(node);
  while (proto && !Object.getOwnPropertyDescriptor(proto, "innerHTML")) proto = Object.getPrototypeOf(proto);
  const d = proto ? Object.getOwnPropertyDescriptor(proto, "innerHTML") : undefined;
  if (!d?.get || !d.set) throw new Error("no innerHTML accessor");
  const { get, set } = d;
  const count = { n: 0 };
  Object.defineProperty(node, "innerHTML", {
    configurable: true,
    get() {
      return get.call(this);
    },
    set(v: string) {
      count.n++;
      set.call(this, v);
    },
  });
  return count;
}

test("hydrate is a no-op on matching SSR, including & < ' in data (Review Focus 3)", async () => {
  const t = createTable(spec, [
    ...rows.map((r) => (r.team === "LV" ? LV_OCONNELL : r)),
    { ...(STANDINGS[0] as Standing), team: "TAM", qb: "Texas A&M <QB>" },
  ]);
  const ssr = renderHTML(t);
  expect(ssr).toContain("Texas A&amp;M &lt;QB&gt;");
  expect(ssr).toContain("Aidan O&#x27;Connell"); // the SSR string; the DOM serializes ' back as '
  const el = mount(ssr);
  const before = body(el);
  const writes = countWrites(el.querySelector("[data-sdv-body]") as Element);
  hydrate(el, t);
  expect(body(el)).toBe(before);
  t.setGlobalFilter(""); // a no-op change: hydrate re-renders the block, and the bytes must not move
  await frame();
  expect(writes.n).toBe(1); // it did re-render
  expect(body(el)).toBe(before);
  expect(before).toContain("Texas A&amp;M &lt;QB&gt;");
});
test("header click cycles the sort and updates aria-sort + rows", async () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const click = async (): Promise<void> => {
    el.querySelector<HTMLButtonElement>('[data-sdv-sort="wins"]')?.click();
    await frame();
  };
  const aria = (): string | null | undefined =>
    el.querySelector('[data-col="wins"]')?.getAttribute("aria-sort");
  await click();
  expect(aria()).toBe("ascending");
  expect(firstTeam(el)).toBe("LV");
  await click();
  expect(aria()).toBe("descending");
  expect(firstTeam(el)).toBe("KC");
  await click();
  expect(aria()).toBeNull(); // M4 (Task 3 fix): aria-sort only on the sorted header
  expect(firstTeam(el)).toBe("KC");
});
test("filter input filters without being re-rendered; pager pages; label and aria-disabled track state", async () => {
  const t = createTable(spec, many, { pageSize: 10 });
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const next = el.querySelector<HTMLButtonElement>('[data-sdv-page="next"]');
  const prev = el.querySelector<HTMLButtonElement>('[data-sdv-page="prev"]');
  const label = (): string | null | undefined => el.querySelector("[data-sdv-page-label]")?.textContent;
  expect(prev?.getAttribute("aria-disabled")).toBe("true");
  next?.click();
  await frame();
  expect(label()).toBe("Page 2 of 4");
  expect(prev?.hasAttribute("aria-disabled")).toBe(false);
  expect(firstTeam(el)).toBe("DET");
  const input = el.querySelector<HTMLInputElement>('[data-sdv-filter="team"]');
  if (!input) throw new Error("no filter input");
  input.focus();
  input.value = "n"; // CIN DEN IND MIN NE NO NYG NYJ TEN
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await frame();
  expect(el.querySelectorAll("[data-sdv-body] tbody tr").length).toBe(9);
  expect(label()).toBe("Page 1 of 1");
  expect(next?.getAttribute("aria-disabled")).toBe("true");
  expect(el.querySelector('[data-sdv-filter="team"]')).toBe(input); // same node, still focused
  expect(document.activeElement).toBe(input);
});
test("teardown removes listeners and drops a pending render", async () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  const before = body(el);
  const off = hydrate(el, t);
  t.setSort("wins", "asc"); // scheduled, not yet drawn
  off();
  await frame();
  expect(body(el)).toBe(before);
  el.querySelector<HTMLButtonElement>('[data-sdv-sort="wins"]')?.click();
  expect(t.state.sort).toEqual({ col: "wins", dir: "asc" }); // the click reached no listener
});
test("I2: hydrating an element again replaces the first binding, so one click acts once; the stale teardown is harmless", async () => {
  const t = createTable({ ...spec, rowKey: "team" }, rows);
  const el = mount(renderHTML(t));
  const first = hydrate(el, t);
  const second = hydrate(el, t); // HMR, client navigation, or an effect with no cleanup
  el.querySelector<HTMLButtonElement>('[data-sdv-sort="wins"]')?.click();
  await frame();
  expect(t.state.sort).toEqual({ col: "wins", dir: "asc" }); // one step of asc → desc → none, not two
  el.querySelector<HTMLElement>('[data-sdv-body] tr[data-row="0"] td')?.click(); // LV, fewest wins
  await frame();
  expect(t.getSelection()).toEqual(new Set(["LV"])); // toggled once, not on and off again
  first(); // the replaced binding's teardown must not unbind its successor
  el.querySelector<HTMLButtonElement>('[data-sdv-sort="wins"]')?.click();
  expect(t.state.sort).toEqual({ col: "wins", dir: "desc" });
  second();
  el.querySelector<HTMLButtonElement>('[data-sdv-sort="wins"]')?.click();
  expect(t.state.sort).toEqual({ col: "wins", dir: "desc" }); // torn down: the click reached no listener
  hydrate(el, t)(); // a fresh binding after teardown works, and tears down
});
test("hydrate throws on markup without a body block", () => {
  document.body.innerHTML = "<div class='sdvt'></div>";
  const el = document.body.firstElementChild as HTMLElement;
  expect(() => hydrate(el, createTable(spec, rows))).toThrow(/data-sdv-body/);
});
test("J31: row hover emits once per row and never re-renders the body; a row click toggles the selection", async () => {
  const t = createTable({ ...spec, rowKey: "team" }, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const seen: unknown[] = [];
  t.subscribe((e) => seen.push(e));
  const before = body(el);
  const kc = el.querySelector<HTMLElement>('[data-sdv-body] tr[data-row="0"] td');
  kc?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  kc?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); // same row: silent
  await frame();
  expect(seen).toEqual([{ type: "hover", id: "KC" }]);
  expect(body(el)).toBe(before);
  kc?.click();
  await frame();
  expect(t.getSelection()).toEqual(new Set(["KC"]));
  expect(el.querySelector('[data-sdv-body] tr[data-row="0"]')?.classList.contains("sdvt-selected")).toBe(
    true,
  );
  el.dispatchEvent(new MouseEvent("mouseleave"));
  expect(seen.at(-1)).toEqual({ type: "hover", id: null });
});
test("M6: ten synchronous changes draw ONE render on the next frame; the engine state moves synchronously", async () => {
  const t = createTable(spec, many);
  const el = mount(renderHTML(t));
  const writes = countWrites(el.querySelector("[data-sdv-body]") as Element);
  hydrate(el, t);
  const input = el.querySelector<HTMLInputElement>("[data-sdv-global-filter]") as HTMLInputElement;
  for (const text of ["N", "NY", "N", "NE", "N", "NY", "N", "NE", "N", "NY"]) {
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(t.state.globalFilter).toBe(text); // handleInput stays synchronous
  }
  expect(writes.n).toBe(0);
  await frame();
  expect(writes.n).toBe(1);
  expect(firstTeam(el)).toBe("NYG");
  expect(el.querySelectorAll("[data-sdv-body] tbody tr").length).toBe(2); // NYG, NYJ
});
test("M6: without requestAnimationFrame the render falls back to a timer", async () => {
  vi.stubGlobal("requestAnimationFrame", undefined);
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  t.setSort("wins", "asc");
  expect(firstTeam(el)).toBe("KC");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(firstTeam(el)).toBe("LV");
});
test("M5: a keyboard sort keeps focus on the re-rendered sort button", async () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const old = el.querySelector<HTMLButtonElement>('[data-sdv-sort="net_epa"]') as HTMLButtonElement;
  old.focus();
  old.click(); // Enter or Space on a focused button
  await frame();
  const now = el.querySelector('[data-sdv-sort="net_epa"]');
  expect(now).not.toBe(old); // the block was rebuilt
  expect(document.activeElement).toBe(now);
});
test("M6: a re-render that keeps the page label leaves its live region's text alone (no re-announcement)", async () => {
  const t = createTable(spec, many, { pageSize: 10 });
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const label = el.querySelector("[data-sdv-page-label]") as Element;
  const text = label.firstChild;
  t.setSort("wins", "desc"); // re-renders the table block; still page 1 of 4
  await frame();
  expect(label.firstChild).toBe(text); // writing the same textContent would replace the text node
  t.setPage(1);
  await frame();
  expect(label.textContent).toBe("Page 2 of 4");
});
test("M1 + M2: Next keeps focus to the last page, the edge click is a no-op, the label is a polite live region", async () => {
  const t = createTable(spec, many, { pageSize: 10 });
  const el = mount(renderHTML(t));
  hydrate(el, t);
  expect(el.querySelector("[data-sdv-page-label]")?.getAttribute("aria-live")).toBe("polite");
  const next = el.querySelector<HTMLButtonElement>('[data-sdv-page="next"]') as HTMLButtonElement;
  next.focus();
  for (let i = 0; i < 3; i++) {
    next.click();
    await frame();
  }
  expect(t.state.page).toBe(3);
  expect(next.getAttribute("aria-disabled")).toBe("true");
  expect(next.disabled).toBe(false); // a disabled button would drop focus to <body>
  expect(document.activeElement).toBe(next);
  const seen: unknown[] = [];
  t.subscribe((e) => seen.push(e));
  next.click();
  expect(seen).toEqual([]); // no engine change, so no re-render
});
test("M8: a hidden column's filter input leaves the toolbar and comes back with its shown label and value; other inputs keep focus", async () => {
  const s = defineTable<Standing>()
    .columns((c) => [c.text("team", { filterable: true }), c.text("qb", { filterable: true }), c.int("wins")])
    .marginalia(["qb"], { label: "Signal caller" })
    .build();
  const t = createTable(s, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const qb = (): HTMLInputElement | null => el.querySelector('[data-sdv-filter="qb"]');
  expect(qb()?.getAttribute("aria-label")).toBeNull(); // labelled by its <label for>
  expect(el.querySelector(`label[for="${qb()?.id}"]`)?.textContent).toBe("Filter Signal caller");
  t.setFilter("qb", "Jo");
  const team = el.querySelector<HTMLInputElement>('[data-sdv-filter="team"]') as HTMLInputElement;
  team.focus();
  t.toggleColumn("qb");
  await frame();
  expect(qb()).toBeNull(); // the filter stays active in the engine, with no input
  expect(t.state.filters.qb).toBe("Jo");
  expect(document.activeElement?.getAttribute("data-sdv-filter")).toBe("team");
  t.toggleColumn("qb");
  await frame();
  expect(qb()?.value).toBe("Jo");
  expect(el.querySelector(`label[for="${qb()?.id}"]`)?.textContent).toBe("Filter Signal caller");
  expect(document.activeElement?.getAttribute("data-sdv-filter")).toBe("team");
  expect(el.querySelector(".sdvt-toolbar")?.outerHTML).toBe(
    mount(renderHTML(t)).querySelector(".sdvt-toolbar")?.outerHTML, // the same markup SSR writes
  );
});
test("I1: an external setGlobalFilter / setFilter / clear shows in the toolbar inputs", async () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const g = el.querySelector<HTMLInputElement>("[data-sdv-global-filter]") as HTMLInputElement;
  const f = el.querySelector<HTMLInputElement>('[data-sdv-filter="team"]') as HTMLInputElement;
  t.setGlobalFilter("x");
  t.setFilter("team", "y");
  await frame();
  expect(g.value).toBe("x");
  expect(f.value).toBe("y");
  expect(el.querySelector('[data-sdv-filter="team"]')).toBe(f); // synced in place, not rebuilt
  t.setGlobalFilter("");
  t.setFilter("team", "");
  await frame();
  expect(g.value).toBe("");
  expect(f.value).toBe("");
});
test("focus on an element inside a custom cell survives a re-render (row id + cell key + index)", async () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  const bodyEl = el.querySelector("[data-sdv-body]") as Element;
  // stand-in for custom cell html: two buttons in each team cell, added after every render
  const addButtons = (): void => {
    for (const td of Array.from(bodyEl.querySelectorAll('td[data-col="team"]')))
      td.insertAdjacentHTML("beforeend", "<button>a</button><button>b</button>");
  };
  let proto: object | null = Object.getPrototypeOf(bodyEl);
  while (proto && !Object.getOwnPropertyDescriptor(proto, "innerHTML")) proto = Object.getPrototypeOf(proto);
  const d = Object.getOwnPropertyDescriptor(proto as object, "innerHTML") as PropertyDescriptor;
  Object.defineProperty(bodyEl, "innerHTML", {
    configurable: true,
    get() {
      return d.get?.call(this);
    },
    set(v: string) {
      d.set?.call(this, v);
      addButtons();
    },
  });
  hydrate(el, t);
  addButtons();
  const pick = (): HTMLElement | undefined =>
    bodyEl.querySelector('tr[data-row="1"] td[data-col="team"]')?.querySelectorAll("button")[1];
  const old = pick() as HTMLElement;
  old.focus();
  expect(document.activeElement).toBe(old);
  t.setGlobalFilter("");
  await frame();
  const now = pick();
  expect(now).not.toBe(old);
  expect(document.activeElement).toBe(now);
});
test("focus restore reads the shadow root's active element", async () => {
  const t = createTable(spec, rows);
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = renderHTML(t).replace(/^<link[^>]*>\n/, "");
  const el = shadow.querySelector("div.sdvt") as HTMLElement;
  hydrate(el, t);
  const old = el.querySelector<HTMLButtonElement>('[data-sdv-sort="wins"]') as HTMLButtonElement;
  old.focus();
  expect(shadow.activeElement).toBe(old);
  old.click();
  await frame();
  const now = el.querySelector('[data-sdv-sort="wins"]');
  expect(now).not.toBe(old);
  expect(shadow.activeElement).toBe(now);
});
test("hiding a column restores the caret of a focused filter input; teardown twice is harmless", async () => {
  const s = defineTable<Standing>()
    .columns((c) => [c.text("team", { filterable: true }), c.text("qb", { filterable: true }), c.int("wins")])
    .build();
  const t = createTable(s, rows);
  const el = mount(renderHTML(t));
  const off = hydrate(el, t);
  const team = el.querySelector<HTMLInputElement>('[data-sdv-filter="team"]') as HTMLInputElement;
  team.value = "abcdef";
  team.dispatchEvent(new Event("input", { bubbles: true })); // the engine now holds the text
  team.focus();
  team.setSelectionRange(2, 4);
  t.toggleColumn("qb");
  await frame();
  const now = el.querySelector<HTMLInputElement>('[data-sdv-filter="team"]') as HTMLInputElement;
  expect(now).not.toBe(team);
  expect(document.activeElement).toBe(now);
  expect([now.selectionStart, now.selectionEnd]).toEqual([2, 4]);
  off();
  expect(() => off()).not.toThrow();
});

/** Task 10: a keydown on `target`; true when nothing consumed it (dispatchEvent's return value). */
const press = (target: Element, key: string, init: KeyboardEventInit = {}): boolean =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
const rowAt = (el: Element, i: number): HTMLElement =>
  el.querySelector<HTMLElement>(`[data-sdv-body] tr[data-row="${i}"]`) as HTMLElement;
const tabStops = (el: Element): string[] =>
  Array.from(
    el.querySelectorAll('[data-sdv-body] tr[tabindex="0"]'),
    (r) => r.getAttribute("data-row") ?? "",
  );

test("Task 10 (A48): j/k move the one tab stop and focus with it; Enter and Space toggle aria-selected; focus survives each re-render", async () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  expect(tabStops(el)).toEqual(["0"]);
  rowAt(el, 0).focus();
  expect(press(rowAt(el, 0), "j")).toBe(false); // consumed
  expect(press(rowAt(el, 1), "j")).toBe(false); // the engine moved at once; the frame has not drawn yet
  await frame();
  expect(t.state.cursor).toEqual({ row: 2, col: null });
  expect(tabStops(el)).toEqual(["2"]);
  expect(document.activeElement).toBe(rowAt(el, 2)); // the REBUILT row
  press(rowAt(el, 2), "k");
  await frame();
  expect(tabStops(el)).toEqual(["1"]);
  expect(document.activeElement).toBe(rowAt(el, 1));
  press(rowAt(el, 1), "Enter");
  await frame();
  expect(t.getSelection()).toEqual(new Set(["1"])); // LAC
  expect(rowAt(el, 1).getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(rowAt(el, 1));
  expect(press(rowAt(el, 1), " ")).toBe(false); // Space toggles too, and never scrolls the page
  await frame();
  expect(rowAt(el, 1).getAttribute("aria-selected")).toBe("false");
});
test("Task 10: h/l pick the column, s cycles its sort through the sort button, / jumps to the search box", async () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  rowAt(el, 0).focus();
  press(rowAt(el, 0), "l"); // nothing sorted and no column yet: from team (the first sortable) to wins
  await frame();
  expect(t.state.cursor).toEqual({ row: 0, col: "wins" });
  expect(el.querySelector("th.sdvt-col-current")?.getAttribute("data-col")).toBe("wins");
  press(rowAt(el, 0), "s");
  await frame();
  expect(el.querySelector('[data-col="wins"]')?.getAttribute("aria-sort")).toBe("ascending");
  expect(firstTeam(el)).toBe("LV");
  expect(document.activeElement).toBe(rowAt(el, 0)); // focus keeps the cursor position
  press(rowAt(el, 0), "s");
  await frame();
  expect(firstTeam(el)).toBe("KC"); // descending
  press(rowAt(el, 0), "l");
  press(rowAt(el, 0), "l"); // net_epa is the last sortable column (qb is not sortable): it stays
  expect(t.state.cursor.col).toBe("net_epa");
  press(rowAt(el, 0), "/");
  expect(document.activeElement).toBe(el.querySelector("[data-sdv-global-filter]"));
});
test("Task 10: j typed in a filter input, with a modifier, or in contenteditable is not a hotkey; hotkeys: false keeps the arrows", async () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const input = el.querySelector<HTMLInputElement>('[data-sdv-filter="team"]') as HTMLInputElement;
  input.focus();
  expect(press(input, "j")).toBe(true); // not consumed: the letter goes into the box
  expect(press(input, "/")).toBe(true);
  expect(press(rowAt(el, 0), "j", { ctrlKey: true })).toBe(true);
  expect(press(rowAt(el, 0), "s", { metaKey: true })).toBe(true);
  rowAt(el, 0)
    .querySelector("td")
    ?.insertAdjacentHTML("beforeend", '<span contenteditable="true">note</span>');
  expect(press(el.querySelector("[contenteditable]") as Element, "j")).toBe(true);
  expect(t.state.cursor).toEqual({ row: 0, col: null });
  expect(t.state.sort).toBeNull();
  expect(document.activeElement).toBe(input);
  const off = createTable({ ...spec, interactive: { hotkeys: false } }, rows);
  const el2 = mount(renderHTML(off));
  hydrate(el2, off);
  expect(press(rowAt(el2, 0), "j")).toBe(true);
  expect(press(rowAt(el2, 0), "ArrowDown")).toBe(false);
  expect(off.state.cursor.row).toBe(1);
});
test("Task 10: under groupBy, j goes to the next row SHOWN, not the next page index", async () => {
  const grouped = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("wins")])
    .groupBy("division")
    .build();
  const t = createTable(grouped, rows, { sort: { col: "wins", dir: "desc" } });
  const el = mount(renderHTML(t));
  hydrate(el, t);
  // wins desc: KC BUF LAC DEN MIA NYJ LV NE (page indices 0-7); grouped, West first: KC LAC DEN LV | BUF MIA NYJ NE
  const order = Array.from(el.querySelectorAll("[data-sdv-body] tr[data-row]"), (r) =>
    r.getAttribute("data-row"),
  );
  expect(order).toEqual(["0", "2", "3", "6", "1", "4", "5", "7"]);
  rowAt(el, 0).focus();
  press(rowAt(el, 0), "j"); // KC -> LAC (page index 2), not BUF (1)
  await frame();
  expect(t.state.cursor.row).toBe(2);
  expect(document.activeElement?.querySelector("td")?.textContent).toBe("LAC");
  press(rowAt(el, 2), "j"); // LAC -> DEN (3), the next row shown
  await frame();
  expect(document.activeElement?.querySelector("td")?.textContent).toBe("DEN");
});

test("Task 10 fix 1 (I1): with no search box, / is not consumed, so the browser's quick-find keeps it", () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  el.querySelector("[data-sdv-global-filter]")?.remove(); // host markup without the global search box
  hydrate(el, t);
  rowAt(el, 0).focus();
  const slash = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
  rowAt(el, 0).dispatchEvent(slash);
  expect(slash.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(rowAt(el, 0));
});
test("Task 10 fix 1 (I2): the cursor column's header carries aria-current, one at a time, beside the visual class", async () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const current = (): (string | null)[] =>
    Array.from(el.querySelectorAll('[data-sdv-body] th[aria-current="true"]'), (th) =>
      th.getAttribute("data-col"),
    );
  expect(current()).toEqual([]); // no column picked yet
  rowAt(el, 0).focus();
  press(rowAt(el, 0), "l");
  await frame();
  expect(current()).toEqual(["wins"]);
  expect(el.querySelector("th.sdvt-col-current")?.getAttribute("aria-current")).toBe("true");
  press(rowAt(el, 0), "l");
  await frame();
  expect(current()).toEqual(["net_epa"]);
});
test("Task 10 fix 1 (4): a held Enter or Space toggles once; the repeats are consumed, so the page never scrolls", async () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  rowAt(el, 1).focus();
  expect(press(rowAt(el, 1), " ")).toBe(false);
  await frame();
  // each repeat is checked on its own: an even number of toggles would hide the bug
  for (const key of [" ", "Enter", " "]) {
    expect(press(rowAt(el, 1), key, { repeat: true }), key).toBe(false);
    expect(t.getSelection(), key).toEqual(new Set(["1"]));
  }
  await frame();
  expect(t.getSelection()).toEqual(new Set(["1"])); // LAC, toggled once
  expect(rowAt(el, 1).getAttribute("aria-selected")).toBe("true");
});
test("Task 10 fix 1 (5): h/l and Left/Right on a link inside a cell pass through; j still leaves the cell for the next row", async () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  // a cell that renders a link (custom cell html; sdvtables has no link kind), as the focus-restore test does
  rowAt(el, 1)
    .querySelector('td[data-col="team"]')
    ?.insertAdjacentHTML("beforeend", ' <a href="#lac">LAC</a>');
  const link = rowAt(el, 1).querySelector("a") as HTMLElement;
  link.focus();
  for (const key of ["ArrowRight", "ArrowLeft", "l", "h"]) expect(press(link, key), key).toBe(true);
  expect(t.state.cursor).toEqual({ row: 0, col: null });
  expect(document.activeElement).toBe(link);
  expect(press(link, "j")).toBe(false);
  await frame();
  expect(document.activeElement).toBe(rowAt(el, 2));
});
