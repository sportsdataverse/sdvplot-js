import { loadLeague, resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import { type TableSpec, defineTable } from "@sportsdataverse/sdvtables";
import { prepare, renderHTML } from "@sportsdataverse/sdvtables/html";
import { tanstackTable } from "@sportsdataverse/sdvtables/tanstack-table";
import type { RowData } from "@tanstack/react-table";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, expect, test } from "vitest";
import { SdvTable, features, renderPart } from "../snippets/tanstack-table/SdvTable.js";
import { STANDINGS, type Standing } from "../src/data.js";

/**
 * The React TanStack Table v9 component the guide shows (examples/snippets/tanstack-table/SdvTable.tsx), drawn by React
 * in jsdom from tanstackTable: each row by its id, each logo its own team's, every cell's text the HTML table's, and a
 * click on a header sorting with missing values last both ways. The Svelte one (snippets/svelte/TanstackStandings)
 * needs Svelte's client runtime, which this project's Node resolution does not pick: the Chromium render test
 * (interactive.test.ts) draws it, checks its rows and logos, and sorts it by a click.
 */
const warnings: string[] = [];
const cleanups: (() => void)[] = [];
beforeAll(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await loadLeague("nfl");
});
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
  warnings.length = 0;
  resetWarnings();
});
setWarningHandler((m) => warnings.push(m));

type Drawn = { host: HTMLElement; click: (th: number) => void };
/** The React snippet's table, mounted in a React root. */
async function react<Row extends RowData>(spec: TableSpec<Row>, rows: readonly Row[]): Promise<Drawn> {
  const sdv = tanstackTable(spec, rows, { features, render: renderPart });
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () => root.render(<SdvTable spec={spec} sdv={sdv} />));
  cleanups.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  return {
    host,
    click: (i) => act(() => (host.querySelectorAll("th")[i]?.querySelector("button") as HTMLElement).click()),
  };
}

/** Each body row: its id and its cells by column id, in display order. */
const bodyRows = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>("tbody tr")).map((tr) => ({
    id: tr.dataset.rowId ?? "",
    tr,
    cell: new Map(Array.from(tr.querySelectorAll<HTMLElement>("td")).map((td) => [td.dataset.col ?? "", td])),
  }));
/** The HTML table's cells and labels, which the TanStack table's must equal. */
function htmlTable<Row>(spec: TableSpec<Row>, rows: readonly Row[]) {
  const doc = new DOMParser().parseFromString(renderHTML(spec, rows, { css: "none" }), "text/html");
  return {
    cell: (row: number, key: string) =>
      doc.querySelector(`tr[data-row="${row}"] td[data-col="${key}"]`) as Element,
    label: (key: string) => doc.querySelector(`th[data-col="${key}"]`)?.textContent?.trim() ?? "",
  };
}

test("React: one row per input row, by rowKey; one logo per row, its own team's; every cell and label the HTML table's", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.logo("team", { league: "nfl", label: "", includeName: true, height: 28 }),
      c.text("qb"),
      c.int("wins"),
      c.num("net_epa", { digits: 3, forceSign: true }),
      c.rank("srs_rank"),
      c.pct("ties", { digits: 1 }),
    ])
    .scaleNote(["wins"], { divisor: 10, decimals: 1, where: "both" })
    .theme("sdv")
    .rowKey("team")
    .build();
  await prepare(spec);
  const { host } = await react(spec, STANDINGS);
  const got = bodyRows(host);
  expect(got.map((r) => r.id)).toEqual(STANDINGS.map((s) => s.team));
  expect(got.map((r) => r.tr.querySelectorAll("img").length)).toEqual(STANDINGS.map(() => 1));
  // the ESPN ids the logos stand for, in row order (KC 12, LAC 24, DEN 7, LV 13, BUF 2, MIA 15, NYJ 20, NE 17)
  expect(got.map((r) => r.cell.get("team")?.querySelector("img")?.dataset.sdvId)).toEqual([
    "12",
    "24",
    "7",
    "13",
    "2",
    "15",
    "20",
    "17",
  ]);
  const html = htmlTable(spec, STANDINGS);
  expect(Array.from(host.querySelectorAll("th")).map((th) => th.textContent?.trim())).toEqual(
    spec.columns.map((c) => html.label(c.key)),
  );
  for (const [i, s] of STANDINGS.entries()) {
    const img = got[i]?.cell.get("team")?.querySelector("img");
    expect(img?.getAttribute("src"), s.team).toBe(
      html.cell(i, "team").querySelector("img")?.getAttribute("src"),
    );
    expect(img?.getAttribute("height")).toBe("28");
    expect(img?.getAttribute("alt"), s.team).toBe(
      html.cell(i, "team").querySelector("img")?.getAttribute("alt"),
    );
    // every cell's text, the team name after its logo included, and the rank's superscript suffix
    for (const k of ["team", "qb", "wins", "net_epa", "srs_rank", "ties"])
      expect(got[i]?.cell.get(k)?.textContent, `${s.team} ${k}`).toBe(html.cell(i, k).textContent);
    expect(got[i]?.cell.get("srs_rank")?.querySelector("sup")?.textContent).toBe(
      html.cell(i, "srs_rank").querySelector("sup")?.textContent,
    );
  }
  expect(got.find((r) => r.id === "NE")?.cell.get("net_epa")?.textContent).toBe(""); // blank, never "NaN" or 0
  // the theme: sdvtables' scoped stylesheet styles the table's th.sdvt-label and td.sdvt-cell
  expect(host.querySelector("style")?.textContent).toMatch(/th\.sdvt-label\{/);
  expect(warnings).toEqual([]);
});

test("React: a click on a header sorts, descending then ascending for a number, a blank net EPA last both ways", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.num("net_epa", { digits: 3 })])
    .rowKey("team")
    .build();
  const { host, click } = await react(spec, STANDINGS);
  const order = () => bodyRows(host).map((r) => r.id);
  const aria = () => host.querySelectorAll("th")[1]?.getAttribute("aria-sort");
  expect(order()).toEqual(STANDINGS.map((s) => s.team));
  expect(aria()).toBe("none");
  const known = STANDINGS.filter((s) => s.net_epa !== null);
  click(1);
  expect(aria()).toBe("descending");
  expect(order()).toEqual([
    ...[...known].sort((a, b) => (b.net_epa ?? 0) - (a.net_epa ?? 0)).map((s) => s.team),
    "NE",
  ]);
  click(1);
  expect(aria()).toBe("ascending");
  expect(order()).toEqual([
    ...[...known].sort((a, b) => (a.net_epa ?? 0) - (b.net_epa ?? 0)).map((s) => s.team),
    "NE",
  ]);
});
