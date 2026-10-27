// @vitest-environment node
import { InputError, preloadAll, resetWarnings, setWarningHandler } from "@sportsdataverse/sdvplot";
import {
  type RowData,
  type SortingState,
  constructTable,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/table-core";
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings";
import { beforeAll, beforeEach, expect, test } from "vitest";
import { defineTable } from "../src/define.js";
import { prepare } from "../src/html/index.js";
import type { TableSpec } from "../src/spec.js";
import { type CellPart, tanstackTable } from "../src/tanstack-table.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";

// tanstackTable through table-core's own constructTable (no framework): sorting, row ids, cell text and the CellPart
// data a framework draws. examples/test/tanstack-table.test.tsx renders the React and Svelte tables the guide shows.

const warnings: string[] = [];
beforeAll(async () => {
  await preloadAll();
});
beforeEach(() => {
  warnings.length = 0;
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
});

/** table-core with its store bindings (what useTable / createTable add) and client-side sorting. */
const features = tableFeatures({
  coreReactivityFeature: storeReactivityBindings(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});
/** Each displayed row as its id and each cell as the column draws it: text, or the CellPart `render` was handed. */
function table<TData extends RowData>(
  spec: TableSpec<TData>,
  rows: readonly TData[],
  sorting: SortingState = [],
) {
  const { options } = tanstackTable(spec, rows, { features, render: (p: CellPart) => p });
  const t = constructTable({ ...options, initialState: { sorting } });
  return t.getRowModel().rows.map((r) => ({
    id: r.id,
    cells: r.getAllCells().map((c) => {
      const cell = c.column.columnDef.cell;
      return typeof cell === "function" ? cell(c.getContext()) : cell;
    }) as (string | CellPart)[],
  }));
}
const idOf = (c: string | CellPart | undefined) => (typeof c === "object" && c.type === "image" ? c.id : c);

test("sorting: sdvtables' comparator, a blank number missing (never 0) and last in both directions", () => {
  type R = { id: string; n: number | null };
  const rows: R[] = [
    { id: "a", n: 3 },
    { id: "b", n: "" as unknown as null }, // a blank cell, as a CSV gives it
    { id: "c", n: 1 },
    { id: "d", n: null },
    { id: "e", n: "x" as unknown as null }, // unparseable
    { id: "f", n: 2 },
  ];
  const spec = defineTable<R>()
    .columns((c) => [c.text("id"), c.int("n")])
    .theme("sdv")
    .rowKey("id")
    .build();
  const order = (desc: boolean) => table(spec, rows, [{ id: "n", desc }]).map((r) => `${r.id}:${r.cells[1]}`);
  expect(order(false)).toEqual(["c:1", "f:2", "a:3", "b:", "d:", "e:"]);
  expect(order(true)).toEqual(["a:3", "f:2", "c:1", "b:", "d:", "e:"]);
  // text sorts by sdvtables' en collator (case-insensitive), a missing value last both ways too
  type T = { k: string; v: string | null };
  const t = defineTable<T>()
    .columns((c) => [c.text("k"), c.text("v")])
    .rowKey("k")
    .build();
  const tr: T[] = [
    { k: "1", v: "b" },
    { k: "2", v: null },
    { k: "3", v: "A" },
    { k: "4", v: "c" },
  ];
  const text = (desc: boolean) => table(t, tr, [{ id: "v", desc }]).map((r) => r.id);
  expect(text(false)).toEqual(["3", "1", "4", "2"]);
  expect(text(true)).toEqual(["4", "1", "3", "2"]);
  // a column's own compare wins: by the length of the name
  const own = defineTable<Standing>()
    .columns((c) => [
      c.text("team"),
      c.text("qb", { compare: (a, b) => String(a).length - String(b).length }),
    ])
    .rowKey("team")
    .build();
  expect(table(own, STANDINGS, [{ id: "qb", desc: false }])[0]?.id).toBe("DEN"); // "Bo Nix"
});

test("cells: the HTML table's number text; images and superscript ranks as CellPart data, the right team in each row", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.logo("team", { league: "nfl", label: "", includeName: true, height: 28 }),
      c.int("wins"),
      c.num("net_epa", { digits: 3, forceSign: true }),
      c.rank("srs_rank"),
      c.rank("pf", { superscript: false }),
    ])
    .theme("sdv")
    .rowKey("team")
    .build();
  await prepare(spec);
  const got = table(spec, STANDINGS);
  expect(got.map((r) => r.id)).toEqual(STANDINGS.map((s) => s.team));
  // the ESPN ids the logos stand for, in row order (KC 12, LAC 24, DEN 7, LV 13, BUF 2, MIA 15, NYJ 20, NE 17)
  expect(got.map((r) => idOf(r.cells[0]))).toEqual(["12", "24", "7", "13", "2", "15", "20", "17"]);
  expect(got[0]?.cells[0]).toEqual({
    type: "image",
    kind: "logo",
    src: expect.stringMatching(/^https:\/\/.+\.png$/),
    alt: "Kansas City Chiefs",
    height: 28,
    id: "12",
    text: "KC",
  });
  expect(got.map((r) => r.cells[2])).toEqual([
    "+0.063",
    "+0.101",
    "+0.108",
    "−0.146", // U+2212, as the HTML table
    "+0.190",
    "−0.019",
    "−0.045",
    "", // New England's blank: empty, never "NaN" or 0
  ]);
  expect(got[0]?.cells[3]).toEqual({ type: "rank", num: "10", suffix: "th", size: expect.any(String) });
  expect(got[0]?.cells[4]).toBe("385th"); // superscript off: the HTML table's plain ordinal
  expect(warnings).toEqual([]);
});

test("numeric team ids (as numbers and as strings) resolve to the same logos as abbreviations, in the right rows", async () => {
  type R = { id: number; espn: number | string };
  // ESPN ids of KC, BUF, BAL and DET, two as numbers and two as strings
  const rows: R[] = [
    { id: 1, espn: 12 },
    { id: 2, espn: "2" },
    { id: 3, espn: 33 },
    { id: 4, espn: " 8 " },
  ];
  const spec = defineTable<R>()
    .columns((c) => [c.logo("espn", { league: "nfl" })])
    .rowKey("id")
    .build();
  const abbr = defineTable<{ t: string }>()
    .columns((c) => [c.logo("t", { league: "nfl" })])
    .build();
  await prepare(spec);
  const src = (c: string | CellPart | undefined) => (typeof c === "object" && c.type === "image" ? c.src : c);
  const want = table(
    abbr,
    ["KC", "BUF", "BAL", "DET"].map((t) => ({ t })),
  ).map((r) => src(r.cells[0]));
  const got = table(spec, rows);
  expect(got.map((r) => r.id)).toEqual(["1", "2", "3", "4"]);
  expect(got.map((r) => idOf(r.cells[0]))).toEqual(["12", "2", "33", "8"]);
  expect(got.map((r) => src(r.cells[0]))).toEqual(want);
  expect(want.every((u) => typeof u === "string" && u.startsWith("https://"))).toBe(true);
});

test("missing assets: a team with colours but no logo, or an unknown team, keeps its text; one warning per value", async () => {
  type R = { team: string; n: number };
  const rows: R[] = [
    { team: "DEL", n: 1 },
    { team: "MINN", n: 2 },
    { team: "DEL", n: 3 },
    { team: "ZZZ", n: 4 },
    { team: "ZZZ", n: 5 },
  ];
  const spec = defineTable<R>()
    .columns((c) => [c.logo("team", { league: "ncaa_whockey" }), c.int("n")])
    .rowKey("n")
    .build();
  await prepare(spec);
  const shown = table(spec, rows).map((r) => (typeof r.cells[0] === "object" ? "img" : r.cells[0]));
  expect(shown).toEqual(["DEL", "img", "DEL", "ZZZ", "ZZZ"]);
  expect(warnings.filter((w) => /logo/.test(w))).toHaveLength(1); // Delaware: no logo archived
  expect(warnings.filter((w) => /ZZZ/.test(w))).toHaveLength(1);
  expect(warnings).toHaveLength(2);
});

test("headshots: each player's ESPN headshot, decorative; a gsis id resolves, an unknown one keeps its text", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.headshot("qb_espn_id", { league: "nfl", height: 40 })])
    .rowKey("qb_espn_id")
    .build();
  const got = table(spec, STANDINGS);
  expect(got.map((r) => r.cells[0])).toEqual(
    STANDINGS.map((s) => ({
      type: "image",
      kind: "headshot",
      src: `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${s.qb_espn_id}.png`,
      alt: "", // the player's name is in the row
      height: 40,
      id: s.qb_espn_id,
    })),
  );
  const gs = defineTable<{ p: string }>()
    .columns((c) => [c.headshot("p", { league: "nfl", idSystem: "gsis" })])
    .build();
  await prepare(gs);
  const g = table(gs, [{ p: "00-0033873" }, { p: "00-9999999" }, { p: "00-9999999" }]);
  expect(typeof g[0]?.cells[0]).toBe("object");
  expect(g.slice(1).map((r) => r.cells[0])).toEqual(["00-9999999", "00-9999999"]);
  expect(warnings.filter((w) => /00-9999999/.test(w))).toHaveLength(1);
});

test("row ids: a repeated or blank rowKey value throws; without a rowKey, TanStack's own index ids", () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .rowKey("team")
    .build();
  const [kc, lac] = STANDINGS as [Standing, Standing];
  expect(() => tanstackTable(spec, [kc, lac, kc], { features })).toThrow(InputError);
  expect(() => tanstackTable(spec, [kc, lac, { ...kc }], { features })).toThrow(
    /rows 0 and 2 have the same rowKey "team" value "KC"/,
  );
  for (const blank of ["", "  ", null, undefined])
    expect(() =>
      tanstackTable(spec, [kc, { ...lac, team: blank } as unknown as Standing], { features }),
    ).toThrow(/row 1 has no value for rowKey "team"/);
  const { options } = tanstackTable(spec, STANDINGS, { features });
  expect(STANDINGS.map((s) => options.getRowId?.(s))).toEqual(STANDINGS.map((s) => s.team));
  expect(options.getRowId?.({ ...kc, team: "SEA" })).toBe("SEA"); // a row added later, by its key
  // no rowKey: no getRowId, so TanStack ids rows by index, and the same object twice is two rows
  const plain = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .build();
  const o = tanstackTable(plain, [kc, kc], { features }).options;
  expect("getRowId" in o).toBe(false);
  expect(table(plain, [kc, kc]).map((r) => r.id)).toEqual(["0", "1"]);
});

test("without render: image and rank cells are text; headers, alignment and widths from the spec; unmapped kinds warn once", () => {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.logo("team", { league: "nfl" }),
      c.rank("srs_rank"),
      c.int("wins", { width: "56px" }),
      c.text("qb", { align: "center" }),
      c.colorPills("pf", { domain: [250, 550] }),
      c.colorPills("pa", { domain: [250, 550] }),
    ])
    .scaleNote(["wins"], { divisor: 10, decimals: 1, where: "both" })
    .rowKey("team")
    .build();
  const { options, columnStyle } = tanstackTable(spec, STANDINGS, { features });
  const row = constructTable(options).getRowModel().rows[0]?.getAllCells() ?? [];
  expect(row.map((c) => (c.column.columnDef.cell as (x: unknown) => unknown)(c.getContext()))).toEqual([
    "KC",
    "10th",
    "1.5",
    "Patrick Mahomes",
    "385",
    "326",
  ]);
  expect(options.columns.map((c) => c.header)).toEqual([
    "Team",
    "Srs Rank",
    expect.stringMatching(/^Wins .+/), // with the scaleNote's suffix
    "Qb",
    "Pf",
    "Pa",
  ]);
  expect(columnStyle).toEqual({
    team: { textAlign: "center" },
    srs_rank: { textAlign: "right" },
    wins: { textAlign: "right", width: "56px" },
    qb: { textAlign: "center" },
    pf: { textAlign: "right" },
    pa: { textAlign: "right" },
  });
  expect(warnings.filter((w) => /colorPills/.test(w))).toHaveLength(1);
});
