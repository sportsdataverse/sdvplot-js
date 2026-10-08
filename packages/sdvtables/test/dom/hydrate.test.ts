import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
// @vitest-environment happy-dom
import { beforeAll, expect, test } from "vitest";
import { createTable } from "../../src/engine.js";
import { hydrate, renderHTML } from "../../src/html/index.js";
import { many, rows, spec } from "../fixtures/engine.js";
import { STANDINGS, type Standing } from "../fixtures/standings.js";

beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll();
});

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  const el = document.body.querySelector("div.sdvt");
  if (!(el instanceof HTMLElement)) throw new Error("no root");
  return el;
}
const firstTeam = (el: Element): string | null | undefined =>
  el.querySelector("[data-sdv-body] tbody tr td")?.textContent;
const body = (el: Element): string => el.querySelector("[data-sdv-body]")?.innerHTML ?? "";

test("hydrate is a no-op on matching SSR, including & < ' in data (Review Focus 3)", () => {
  const t = createTable(spec, [
    ...rows,
    { ...(STANDINGS[0] as Standing), team: "TAM", qb: "Texas A&M <QB>" },
  ]);
  const ssr = renderHTML(t);
  expect(ssr).toContain("Texas A&amp;M &lt;QB&gt;");
  expect(ssr).toContain("Aidan O&#x27;Connell"); // the SSR string; the DOM serializes ' back as '
  const el = mount(ssr);
  const before = body(el);
  hydrate(el, t);
  expect(body(el)).toBe(before);
  t.setGlobalFilter(""); // a no-op change: hydrate re-renders the block, and the bytes must not move
  expect(body(el)).toBe(before);
  expect(before).toContain("Texas A&amp;M &lt;QB&gt;");
});
test("header click cycles the sort and updates aria-sort + rows", () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const click = (): void => {
    el.querySelector<HTMLButtonElement>('[data-sdv-sort="wins"]')?.click();
  };
  const aria = (): string | null | undefined =>
    el.querySelector('[data-col="wins"]')?.getAttribute("aria-sort");
  click();
  expect(aria()).toBe("ascending");
  expect(firstTeam(el)).toBe("LV");
  click();
  expect(aria()).toBe("descending");
  expect(firstTeam(el)).toBe("KC");
  click();
  expect(aria()).toBeNull(); // M4 (Task 3 fix): aria-sort only on the sorted header
  expect(firstTeam(el)).toBe("KC");
});
test("filter input filters without being re-rendered; pager pages; label and disabled track state", () => {
  const t = createTable(spec, many, { pageSize: 10 });
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const next = el.querySelector<HTMLButtonElement>('[data-sdv-page="next"]');
  const prev = el.querySelector<HTMLButtonElement>('[data-sdv-page="prev"]');
  expect(prev?.disabled).toBe(true);
  next?.click();
  expect(el.querySelector("[data-sdv-page-label]")?.textContent).toBe("2 / 3");
  expect(prev?.disabled).toBe(false);
  expect(firstTeam(el)).toBe("T11");
  const input = el.querySelector<HTMLInputElement>('[data-sdv-filter="team"]');
  if (!input) throw new Error("no filter input");
  input.focus();
  input.value = "T0";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  expect(el.querySelectorAll("[data-sdv-body] tbody tr").length).toBe(9);
  expect(el.querySelector("[data-sdv-page-label]")?.textContent).toBe("1 / 1");
  expect(next?.disabled).toBe(true);
  expect(el.querySelector('[data-sdv-filter="team"]')).toBe(input); // same node, still focused
  expect(document.activeElement).toBe(input);
});
test("teardown removes listeners", () => {
  const t = createTable(spec, rows);
  const el = mount(renderHTML(t));
  const off = hydrate(el, t);
  off();
  el.querySelector<HTMLButtonElement>('[data-sdv-sort="wins"]')?.click();
  expect(t.state.sort).toBeNull();
});
test("hydrate throws on markup without a body block", () => {
  document.body.innerHTML = "<div class='sdvt'></div>";
  const el = document.body.firstElementChild as HTMLElement;
  expect(() => hydrate(el, createTable(spec, rows))).toThrow(/data-sdv-body/);
});
test("J31: row hover emits once per row and never re-renders the body; a row click toggles the selection", () => {
  const t = createTable({ ...spec, rowKey: "team" }, rows);
  const el = mount(renderHTML(t));
  hydrate(el, t);
  const seen: unknown[] = [];
  t.subscribe((e) => seen.push(e));
  const before = body(el);
  const kc = el.querySelector<HTMLElement>('[data-sdv-body] tr[data-row="0"] td');
  kc?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  kc?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); // same row: silent
  expect(seen).toEqual([{ type: "hover", id: "KC" }]);
  expect(body(el)).toBe(before);
  kc?.click();
  expect(t.getSelection()).toEqual(new Set(["KC"]));
  expect(el.querySelector('[data-sdv-body] tr[data-row="0"]')?.classList.contains("sdvt-selected")).toBe(
    true,
  );
  el.dispatchEvent(new MouseEvent("mouseleave"));
  expect(seen.at(-1)).toEqual({ type: "hover", id: null });
});
