// @vitest-environment happy-dom
import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
import { beforeAll, expect, test } from "vitest";
import { createTable } from "../src/engine.js";
import { rowIdAt } from "../src/html/controls.js";
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
