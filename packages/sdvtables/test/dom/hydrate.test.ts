import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
// @vitest-environment happy-dom
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { defineTable } from "../../src/define.js";
import { createTable } from "../../src/engine.js";
import { hydrate, renderHTML } from "../../src/html/index.js";
import { many, rows, spec } from "../fixtures/engine.js";
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
    ...rows,
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
  expect(label()).toBe("Page 2 of 3");
  expect(prev?.hasAttribute("aria-disabled")).toBe(false);
  expect(firstTeam(el)).toBe("T11");
  const input = el.querySelector<HTMLInputElement>('[data-sdv-filter="team"]');
  if (!input) throw new Error("no filter input");
  input.focus();
  input.value = "T0";
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
  for (const text of ["T", "T0", "T1", "T2", "T", "T0", "T1", "T2", "T", "T2"]) {
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(t.state.globalFilter).toBe(text); // handleInput stays synchronous
  }
  expect(writes.n).toBe(0);
  await frame();
  expect(writes.n).toBe(1);
  expect(firstTeam(el)).toBe("T20");
  expect(el.querySelectorAll("[data-sdv-body] tbody tr").length).toBe(6); // T20..T25
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
test("M1 + M2: Next keeps focus to the last page, the edge click is a no-op, the label is a polite live region", async () => {
  const t = createTable(spec, many, { pageSize: 10 });
  const el = mount(renderHTML(t));
  hydrate(el, t);
  expect(el.querySelector("[data-sdv-page-label]")?.getAttribute("aria-live")).toBe("polite");
  const next = el.querySelector<HTMLButtonElement>('[data-sdv-page="next"]') as HTMLButtonElement;
  next.focus();
  next.click();
  await frame();
  next.click();
  await frame();
  expect(t.state.page).toBe(2);
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
