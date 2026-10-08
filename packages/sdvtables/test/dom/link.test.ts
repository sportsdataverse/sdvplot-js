// @vitest-environment jsdom
import * as Plot from "@observablehq/plot";
import {
  type SelectionStore,
  createSelection,
  loadLeague,
  setWarningHandler,
} from "@sportsdataverse/sdvplot";
import { type LinkableTable, brushFilter, linkSelection } from "@sportsdataverse/sdvplot/interact";
import { linkIds, logos } from "@sportsdataverse/sdvplot/plot";
import { beforeAll, expect, expectTypeOf, test, vi } from "vitest";
import { BKN, BKN_GAMES, type BknGame, type BknShot } from "../../../sdvplot/test/shots/fixture.js";
import { defineTable } from "../../src/define.js";
import { type Table, type TableEvent, createTable } from "../../src/engine.js";
import { spec } from "../fixtures/engine.js";
import { STANDINGS, type Standing } from "../fixtures/standings.js";

const keyed = { ...spec, rowKey: "team" } satisfies typeof spec;
const warnings: string[] = [];
beforeAll(async () => {
  setWarningHandler((m) => warnings.push(m));
  await loadLeague("nfl");
});
// 2024 AFC: wins x net EPA/play, one dot per team keyed by abbreviation (NE: net_epa null, so no dot)
const figure = (): ReturnType<typeof Plot.plot> =>
  Plot.plot({
    width: 640,
    height: 400,
    x: { domain: [0, 17] },
    y: { domain: [-0.2, 0.2] },
    marks: [Plot.dot(STANDINGS, { x: "wins", y: "net_epa", r: 6, render: linkIds(STANDINGS, "team") })],
  });
const lit = (root: Element): (string | null)[] =>
  Array.from(root.querySelectorAll(".sdv-hl")).map((e) => e.getAttribute("data-sdv-id"));
const linked = (pageSize = Number.POSITIVE_INFINITY) => {
  const svg = figure();
  const table = createTable(keyed, STANDINGS, { pageSize });
  const store: SelectionStore<Standing> = createSelection<Standing>();
  const off = linkSelection(store, { figure: svg, table });
  return { svg, table, store, off };
};
/** The engine's hover events, as hydrate and <SdvTable/> receive them. */
const hovers = <Row>(table: Table<Row>): (string | null)[] => {
  const seen: (string | null)[] = [];
  table.subscribe((e: TableEvent) => {
    if (e.type === "hover") seen.push(e.id);
  });
  return seen;
};

test("an sdvtables Table IS a LinkableTable: structural, so sdvplot needs no sdvtables dependency", () => {
  expectTypeOf<Table<Standing>>().toMatchTypeOf<LinkableTable<Standing>>();
});
test("brush on the figure → the table filters to the brushed rows and selects them; clearing restores all 8", () => {
  const { svg, table, store } = linked();
  const brush = brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" });
  brush.move({ x: [9.5, 16], y: [0, 0.2] });
  expect(table.rows.map((r) => r.team)).toEqual(["KC", "LAC", "DEN", "BUF"]);
  expect([...table.getSelection()]).toEqual(["KC", "LAC", "DEN", "BUF"]);
  expect(lit(svg)).toEqual(["KC", "LAC", "DEN", "BUF"]);
  brush.move(null);
  expect(table.filteredCount).toBe(8); // NE, never brushable, is back too
  expect(svg.classList.contains("sdv-focus")).toBe(false);
});
test("a table unlinked mid-brush shows all its rows again and drops the hover it showed; the store keeps both", () => {
  const svg = figure();
  const table = createTable(keyed, STANDINGS);
  const store = createSelection<Standing>();
  const offFigure = linkSelection(store, { figure: svg });
  const offTable = linkSelection(store, { table });
  brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" }).move({
    x: [9.5, 16],
    y: [0, 0.2],
  });
  store.set({ hover: ["LAC"] }); // another writer's hover
  expect([table.filteredCount, table.getHover(), svg.classList.contains("sdv-focus")]).toEqual([
    4,
    "LAC",
    true,
  ]);
  const region = store.getState().predicate;
  offFigure(); // the figure is unlinked first: it un-dims while the table still follows the brush
  expect([svg.classList.contains("sdv-focus"), lit(svg), table.filteredCount]).toEqual([false, [], 4]);
  offTable();
  expect([table.filteredCount, table.getHover()]).toEqual([8, null]);
  const s = store.getState();
  expect([s.predicate, [...s.hover], [...s.selected]]).toEqual([
    region,
    ["LAC"],
    ["KC", "LAC", "DEN", "BUF"],
  ]);
  // one call linking both restores both
  const both = linked();
  brushFilter(both.svg, both.store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" }).move({
    x: [9.5, 16],
    y: [0, 0.2],
  });
  both.off();
  expect([both.table.filteredCount, both.svg.classList.contains("sdv-focus")]).toEqual([8, false]);
});
test("a brush resets the table to page 0 of the filtered rows (Review Focus 5)", () => {
  const { svg, table, store } = linked(3);
  table.setPage(2);
  brushFilter(svg, store, { data: STANDINGS, x: "wins", y: "net_epa", id: "team" }).move({
    x: [9.5, 16],
    y: [0, 0.2],
  });
  expect(table.state.page).toBe(0);
  expect(table.pageCount).toBe(2);
  expect(table.rows.map((r) => r.team)).toEqual(["KC", "LAC", "DEN"]);
});
test("table hover and click highlight the figure; each settles in ONE store update (no ping-pong)", () => {
  const { svg, table, store } = linked();
  const fn = vi.fn();
  store.subscribe(fn);
  table.setHover("BUF"); // what hydrate's mouseover calls
  expect(lit(svg)).toEqual(["BUF"]);
  table.setSelection(new Set(["KC"])); // what a row click calls
  expect(fn).toHaveBeenCalledTimes(2);
  expect(lit(svg)).toEqual(["KC", "BUF"]);
});
test("figure hover → store.hover → the table's hover event; the table is not re-filtered", () => {
  const { svg, table, store } = linked();
  const seen = hovers(table);
  svg.querySelector('[data-sdv-id="LV"]')?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  expect([...store.getState().hover]).toEqual(["LV"]);
  expect(seen).toEqual(["LV"]); // what hydrate and <SdvTable/> paint as sdvt-hover
  expect(table.filteredCount).toBe(8);
  svg.dispatchEvent(new MouseEvent("mouseleave"));
  expect(store.getState().hover.size).toBe(0);
  expect(seen).toEqual(["LV", null]);
});
test("the table never echoes a narrowed hover back: a two-id store hover stays two ids (A29)", () => {
  const { svg, table, store } = linked();
  const seen = hovers(table);
  const fn = vi.fn();
  store.subscribe(fn);
  store.set({ hover: ["KC", "BUF"] }); // e.g. a nearest-point writer, or a caller
  expect(seen).toEqual(["KC"]); // the engine holds one hover id: the first
  expect([...store.getState().hover]).toEqual(["KC", "BUF"]);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(lit(svg)).toEqual(["KC", "BUF"]);
});
test("ids absent from one side (Review Focus 3): nothing throws, nothing is pruned, one warning", () => {
  const { svg, table, store } = linked();
  table.setHover("NE"); // a table row with no dot
  expect(lit(svg)).toEqual([]);
  expect(svg.classList.contains("sdv-focus")).toBe(true);
  store.set({ selected: ["SEA", "KC"] }); // SEA: no row, no dot
  expect(table.getSelection()).toEqual(new Set(["SEA", "KC"]));
  expect(lit(svg)).toEqual(["KC"]);
  table.setHover(null);
  table.setHover("NE");
  expect(warnings.filter((w) => w.startsWith("none of the linked ids (NE)"))).toHaveLength(1);
});
test("logos stamped with ESPN team ids vs a table keyed by abbreviation: the mismatch warns; `id` fixes it", () => {
  const table = createTable(keyed, STANDINGS);
  const store = createSelection<Standing>();
  const espn = Plot.plot({ marks: [logos(STANDINGS, { league: "nfl", x: "wins", y: "pf", team: "team" })] });
  linkSelection(store, { figure: espn, table });
  table.setHover("MIA");
  expect(lit(espn)).toEqual([]); // MIA's logo is stamped "15"
  expect(warnings.filter((w) => w.startsWith("none of the linked ids (MIA)"))).toHaveLength(1);
  const abbr = Plot.plot({
    marks: [logos(STANDINGS, { league: "nfl", x: "wins", y: "pf", team: "team", id: "team" })],
  });
  linkSelection(store, { figure: abbr });
  expect(lit(abbr)).toEqual(["MIA"]);
  table.setSelection(new Set(["KC", "BUF"]));
  expect(lit(abbr)).toEqual(["KC", "BUF", "MIA"]); // document order: the rows' order
});
test("linkIds on logos with href: selecting KC lights KC's logo, its hover writes KC, the abbreviation-keyed table lights", () => {
  const table = createTable(keyed, STANDINGS);
  const store = createSelection<Standing>();
  const svg = Plot.plot({
    marks: [
      logos(STANDINGS, {
        league: "nfl",
        x: "wins",
        y: "pf",
        team: "team",
        href: (d: Standing) => `#${d.team}`,
        render: linkIds(STANDINGS, "team"),
      }),
    ],
  });
  linkSelection(store, { figure: svg, table });
  const seen = hovers(table);
  store.set({ selected: ["KC"] });
  // the logo itself is lit: a lit <a> around an image stamped "12" left the selected logo dimmed
  const litTags = Array.from(svg.querySelectorAll(".sdv-hl")).map(
    (e) => `${e.tagName}:${e.getAttribute("data-sdv-id")}`,
  );
  expect(litTags).toEqual(["image:KC"]);
  store.clear();
  svg.querySelector('a[href="#KC"] > image')?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  expect([...store.getState().hover]).toEqual(["KC"]); // never KC's ESPN id "12"
  expect(seen).toEqual(["KC"]); // what hydrate and <SdvTable/> paint as sdvt-hover
});
test("teardown detaches the figure and the table", () => {
  const { svg, table, store, off } = linked();
  off();
  table.setHover("KC");
  svg.querySelector('[data-sdv-id="LV"]')?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  expect(store.getState().hover.size).toBe(0);
  store.set({ selected: ["KC"] });
  expect(table.getSelection().size).toBe(0);
});

test("unlinking a table whose row is hovered clears that hover, so the figure stops dimming; a later hover stays", () => {
  const svg = figure();
  const table = createTable(keyed, STANDINGS);
  const store = createSelection<Standing>();
  linkSelection(store, { figure: svg });
  const offTable = linkSelection(store, { table });
  table.setHover("BUF"); // the pointer on Buffalo's row
  expect(lit(svg)).toEqual(["BUF"]);
  offTable(); // the table unmounts under the pointer: no mouseleave will come
  expect(store.getState().hover.size).toBe(0);
  expect(svg.classList.contains("sdv-focus")).toBe(false);
  const again = linkSelection(store, { table });
  store.set({ hover: ["KC"] }); // the figure's hover, not the table's
  again();
  expect([...store.getState().hover]).toEqual(["KC"]);
});

// Brooklyn's 2025-26 shots (fixtures/shots): legacy court coordinates in tenths of a foot, the hoop at the origin.
const shotSpec = defineTable<BknShot>()
  .columns((c) => [c.text("game_id"), c.int("shot_distance"), c.int("shot_value"), c.text("shot_result")])
  .build(); // no rowKey: a row's id is its index into BKN, as linkIds stamps by default
const shotChart = (id?: "game_id"): ReturnType<typeof Plot.plot> =>
  Plot.plot({
    width: 500,
    height: 470,
    x: { domain: [-250, 250] },
    y: { domain: [-52, 418] },
    marks: [
      Plot.dot(BKN, { x: "x_legacy", y: "y_legacy", r: 2, render: id ? linkIds(BKN, id) : linkIds(BKN) }),
    ],
  });
// within 4 ft of the hoop, in front of it (integer coordinates, so the half-units keep the edges unambiguous):
// measured from the fixture, 585 of the 2000 shots
const RIM = { x: [-40.5, 40.5], y: [-10.5, 40.5] } as const;

test("BKN shots: the default ids (row index into the SAME rows) link a shot chart and a 2000-row table both ways", () => {
  const svg = shotChart();
  const table = createTable(shotSpec, BKN, { pageSize: 10 });
  const store = createSelection<BknShot>();
  linkSelection(store, { figure: svg, table });
  const seen = hovers(table);
  // chart → table, selection: a brush at the rim filters and selects the same 585 shots
  table.setPage(5);
  const brush = brushFilter(svg, store, { data: BKN, x: "x_legacy", y: "y_legacy" });
  brush.move(RIM);
  expect(table.filteredCount).toBe(585);
  expect(table.getSelection().size).toBe(585);
  expect(lit(svg)).toHaveLength(585);
  expect(table.state.page).toBe(0);
  expect(table.pageCount).toBe(59);
  const first = table.rows[0] as BknShot;
  expect(Math.abs(first.x_legacy) <= 40 && first.y_legacy >= -10 && first.y_legacy <= 40).toBe(true);
  // chart → table, hover: a shot's dot names its table row
  const id = table.rowId(first);
  svg.querySelector(`[data-sdv-id="${id}"]`)?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  expect(seen).toEqual([id]);
  svg.dispatchEvent(new MouseEvent("mouseleave"));
  brush.move(null);
  expect(table.filteredCount).toBe(2000);
  // table → chart, selection and hover: a row click and a row hover light exactly that shot
  table.setSelection(new Set(["1999"]));
  expect(lit(svg)).toEqual(["1999"]);
  table.setSelection(new Set());
  table.setHover("17");
  expect(lit(svg)).toEqual(["17"]);
  expect([...store.getState().hover]).toEqual(["17"]);
});
test("BKN games: one game row lights every shot of that game, and a shot's hover names its game row", () => {
  const games = createTable(
    defineTable<BknGame>()
      .columns((c) => [c.text("game_date"), c.text("matchup"), c.text("wl")])
      .rowKey("game_id")
      .build(),
    BKN_GAMES,
  );
  const svg = shotChart("game_id");
  const store = createSelection<BknGame>();
  linkSelection(store, { figure: svg, table: games });
  const seen = hovers(games);
  const opener = BKN_GAMES[0] as BknGame; // 2025-10-22, BKN @ CHA
  games.setHover(opener.game_id);
  expect(lit(svg)).toHaveLength(BKN.filter((s) => s.game_id === opener.game_id).length);
  expect(lit(svg)).toHaveLength(88); // measured: the opener's shots in the fixture
  games.setHover(null);
  const shot = BKN[1000] as BknShot;
  svg
    .querySelector(`[data-sdv-id="${shot.game_id}"]`)
    ?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  expect(seen.at(-1)).toBe(shot.game_id);
  games.setSelection(new Set([opener.game_id]));
  expect([...store.getState().selected]).toEqual([opener.game_id]);
});
