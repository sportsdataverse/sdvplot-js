// @vitest-environment node
import { createSelection } from "@sportsdataverse/sdvplot";
import { linkSelection } from "@sportsdataverse/sdvplot/interact";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { createTable } from "../src/engine.js";
import { renderHTML } from "../src/html/index.js";
import { SdvTable } from "../src/react/index.js";
import { spec } from "./fixtures/engine.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";

const keyed = { ...spec, rowKey: "team" } satisfies typeof spec;
const active = () => {
  const store = createSelection<Standing>();
  store.set({ hover: ["BUF"], selected: ["KC"], predicate: (r) => r.wins > 10 }); // an ACTIVE store
  return store;
};

test("SSR: linking a table in Node changes neither the engine nor its markup (Review Focus 1)", () => {
  const before = renderHTML(createTable(keyed, STANDINGS));
  const table = createTable(keyed, STANDINGS);
  const snap = table.getSnapshot();
  const off = linkSelection(active(), { table });
  expect(table.getSnapshot()).toBe(snap);
  expect(renderHTML(table)).toBe(before);
  off();
});
test("SSR: a linked <SdvTable table/> renders the same string as an unlinked one, which is renderHTML's (A50)", () => {
  const html = (link: boolean): string => {
    const table = createTable(keyed, STANDINGS);
    if (link) linkSelection(active(), { table });
    return renderToStaticMarkup(createElement(SdvTable<Standing>, { table, interactive: true }));
  };
  expect(html(true)).toBe(html(false));
  expect(html(true)).toBe(renderHTML(createTable(keyed, STANDINGS), { fonts: false }));
});
