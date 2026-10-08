import { describe, expect, test, vi } from "vitest";
import {
  applySort,
  compareDate,
  compareNum,
  compareText,
  createTable,
  isMissing,
  matches,
  nextSortDir,
  paginate,
  withMissingLast,
} from "../src/engine.js";
import { TableSpecError } from "../src/errors.js";
import { many, rows, spec } from "./fixtures/engine.js";
import { STANDINGS, type Standing } from "./fixtures/standings.js";

const teams = (t: { rows: readonly { team: string }[] }): string[] => t.rows.map((r) => r.team);
const withNaN: readonly Standing[] = [
  ...STANDINGS,
  { ...(STANDINGS[0] as Standing), team: "NAN", net_epa: Number.NaN },
];

describe("sorting", () => {
  test("nulls last both directions (Review Focus 1)", () => {
    const t = createTable(spec, withNaN);
    t.setSort("net_epa", "asc");
    expect(teams(t)).toEqual(["LV", "NYJ", "MIA", "DEN", "KC", "LAC", "BUF", "NE", "NAN"]);
    t.setSort("net_epa", "desc");
    expect(teams(t)).toEqual(["BUF", "LAC", "KC", "DEN", "MIA", "NYJ", "LV", "NE", "NAN"]);
  });
  test("stable: ties keep input order", () => {
    const t = createTable(spec, rows);
    t.setSort("wins", "asc"); // LV and NE both 4 wins; LV comes first in STANDINGS
    expect(teams(t).slice(0, 2)).toEqual(["LV", "NE"]);
  });
  test("text is case-insensitive and numeric-aware", () => {
    const t = createTable(spec, rows);
    t.setSort("team", "asc");
    expect(teams(t)).toEqual(["BUF", "DEN", "KC", "LAC", "LV", "MIA", "NE", "NYJ"]);
    expect(compareText("Team 2", "Team 10")).toBeLessThan(0);
    expect(compareText("alabama", "Baylor")).toBeLessThan(0);
  });
  test("text order is pinned to the en locale, not the host default", () => {
    expect(compareText("Édouard", "Eduardo")).toBeLessThan(0); // accent-insensitive: "Edo" before "Edu"
    expect(compareText("Öberg", "Zimmer")).toBeLessThan(0); // en: Ö ~ O; sv/fi/da would put Ö after Z
    expect(compareText("Ångström", "Bohr")).toBeLessThan(0); // en: Å ~ A; sv would put Å after Z
  });
  test("an invalid Date is missing, so it sorts last and compareDate stays transitive", () => {
    const bad = new Date("not a date");
    expect(isMissing(bad)).toBe(true);
    const cmp = withMissingLast(compareDate, "asc");
    expect(cmp(bad, new Date(0))).toBe(1);
    expect(cmp(new Date(0), bad)).toBe(-1);
    expect(cmp(new Date(0), new Date(1))).toBeLessThan(0);
  });
  test("comparator never returns NaN", () => {
    const cmp = withMissingLast(compareNum, "asc");
    expect(cmp(Number.NaN, 3)).toBe(1);
    expect(cmp(3, Number.NaN)).toBe(-1);
    expect(cmp(Number.NaN, Number.NaN)).toBe(0);
    expect(cmp(null, undefined)).toBe(0);
    expect(cmp("", 1)).toBe(1);
  });
  test("custom compare wins over the kind comparator", () => {
    const bySecondLetter = defineSpecWithCompare();
    const t = createTable(bySecondLetter, rows);
    t.setSort("team", "asc");
    expect(teams(t)[0]).toBe("LAC"); // second letter "A"
  });
  test("setSort(col, null) restores input order; unknown column throws", () => {
    const t = createTable(spec, rows);
    t.setSort("wins", "asc");
    t.setSort("wins", null);
    expect(teams(t)).toEqual(rows.map((r) => r.team));
    expect(() => t.setSort("nope", "asc")).toThrow(TableSpecError);
  });
  test("nextSortDir cycles asc → desc → null", () => {
    expect(nextSortDir(null, "wins")).toBe("asc");
    expect(nextSortDir({ col: "wins", dir: "asc" }, "wins")).toBe("desc");
    expect(nextSortDir({ col: "wins", dir: "desc" }, "wins")).toBeNull();
    expect(nextSortDir({ col: "wins", dir: "desc" }, "net_epa")).toBe("asc");
  });
  test("applySort does not mutate its input", () => {
    const copy = [...rows];
    applySort(spec, rows, { col: "wins", dir: "asc" });
    expect(rows).toEqual(copy);
  });
});

describe("filtering", () => {
  test("string filter is a case-insensitive substring; predicate filter gets (value, row)", () => {
    const t = createTable(spec, rows);
    t.setFilter("team", "l");
    expect(teams(t)).toEqual(["LAC", "LV"]);
    t.setFilter("team", (_v, r) => r.wins > 10);
    expect(teams(t)).toEqual(["KC", "LAC", "BUF"]);
    t.setFilter("team", null);
    expect(t.rows.length).toBe(8);
  });
  test("global filter searches visible columns only", () => {
    const t = createTable(spec, rows);
    t.setGlobalFilter("herbert");
    expect(teams(t)).toEqual(["LAC"]);
    t.toggleColumn("qb", false);
    expect(teams(t)).toEqual([]);
  });
  test("number and boolean filters are strict equality; false and 0 are kept, not cleared", () => {
    const t = createTable(spec, rows);
    t.setFilter("wins", 4);
    expect(teams(t)).toEqual(["LV", "NE"]);
    t.setFilter("wins", 0);
    expect(t.state.filters.wins).toBe(0);
    expect(t.rows).toEqual([]);
    t.setFilter("wins", false);
    expect(t.state.filters.wins).toBe(false);
    expect(t.rows).toEqual([]);
    expect(matches(true, true, rows[0])).toBe(true);
    expect(matches(true, "true", rows[0])).toBe(false);
    expect(matches(4, "4", rows[0])).toBe(false);
  });
  test("unknown column throws TableSpecError from setFilter, toggleColumn and options.sort", () => {
    const t = createTable(spec, rows);
    expect(() => t.setFilter("nope", "x")).toThrow(TableSpecError);
    expect(() => t.toggleColumn("nope")).toThrow(TableSpecError);
    expect(() => createTable(spec, rows, { sort: { col: "nope", dir: "asc" } })).toThrow(TableSpecError);
  });
  test("filter resets page (Review Focus 2)", () => {
    const t = createTable(spec, many, { pageSize: 10 });
    t.setPage(2);
    expect(t.state.page).toBe(2);
    t.setGlobalFilter("T0"); // T01..T09
    expect(t.state.page).toBe(0);
    expect(t.filteredCount).toBe(9);
    expect(t.pageCount).toBe(1);
  });
});

describe("pagination", () => {
  test("pure slice; pageCount >= 1 even for zero rows", () => {
    expect(paginate(many, 1, 10).rows.map((r) => r.team)).toEqual(many.slice(10, 20).map((r) => r.team));
    expect(paginate([], 0, 10)).toEqual({ rows: [], pageCount: 1 });
    expect(paginate(many, 0, Number.POSITIVE_INFINITY).pageCount).toBe(1);
  });
  test("setPage clamps; setPageSize validates; spec.interactive.pageSize is the default", () => {
    const t = createTable(spec, many, { pageSize: 10 });
    expect(t.pageCount).toBe(3);
    t.setPage(99);
    expect(t.state.page).toBe(2);
    t.setPage(-1);
    expect(t.state.page).toBe(0);
    expect(() => t.setPageSize(0)).toThrow(TableSpecError);
    expect(() => t.setPageSize(2.5)).toThrow(TableSpecError);
    t.setPageSize(Number.POSITIVE_INFINITY);
    expect(t.rows.length).toBe(25);
    expect(createTable({ ...spec, interactive: { pageSize: 5 } }, many).pageCount).toBe(5);
  });
  test("setPage ignores non-finite input", () => {
    const t = createTable(spec, many, { pageSize: 10 });
    t.setPage(1);
    const fn = vi.fn();
    t.subscribe(fn);
    t.setPage(Number.NaN);
    t.setPage(Number.POSITIVE_INFINITY);
    expect(t.state.page).toBe(1);
    expect(t.rows.length).toBe(10);
    expect(t.pageCount).toBe(3);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("columns + subscription", () => {
  test("hiding the sorted column clears the sort", () => {
    const t = createTable(spec, rows);
    t.setSort("wins", "asc");
    t.toggleColumn("wins");
    expect(t.state.sort).toBeNull();
    expect(t.columns.map((c) => c.key)).toEqual(["team", "net_epa", "qb"]);
    t.toggleColumn("wins", true);
    expect(t.columns.length).toBe(4);
  });
  test("subscribe fires once per mutation; unsubscribe stops it; snapshot is referentially stable", () => {
    const t = createTable(spec, rows);
    const fn = vi.fn();
    const off = t.subscribe(fn);
    const s1 = t.getSnapshot();
    expect(t.getSnapshot()).toBe(s1);
    t.setSort("wins", "asc");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(t.getSnapshot()).not.toBe(s1);
    off();
    t.setSort("wins", null);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  test("state objects are immutable snapshots", () => {
    const t = createTable(spec, rows);
    const before = t.state;
    t.setGlobalFilter("x");
    expect(before.globalFilter).toBe("");
    expect(t.state.globalFilter).toBe("x");
  });
});

function defineSpecWithCompare(): typeof spec {
  const team = spec.columns[0];
  if (!team || team.kind !== "text") throw new Error("fixture changed");
  return {
    ...spec,
    columns: [
      { ...team, compare: (a: unknown, b: unknown) => String(a).charCodeAt(1) - String(b).charCodeAt(1) },
      ...spec.columns.slice(1),
    ],
  };
}

describe("J31 seam: rowKey, external filter, selection, events", () => {
  const keyed = { ...spec, rowKey: "team" } satisfies typeof spec;
  test("rowId is String(row[rowKey]); without rowKey it is the input index, stable across sort", () => {
    expect(createTable(keyed, rows).rowId(rows[3] as Standing)).toBe("LV");
    const t = createTable(spec, rows);
    t.setSort("wins", "asc");
    expect(t.rowId(t.rows[0] as Standing)).toBe("3"); // LV, 4th input row, sorts first
  });
  test("external filter ANDs with the others, resets page, and the same function again is silent", () => {
    const t = createTable(spec, many, { pageSize: 10 });
    const events: string[] = [];
    t.subscribe((e) => events.push(e.type));
    t.setPage(2);
    const fewWins = (r: Standing): boolean => r.wins <= 4;
    t.setExternalFilter(fewWins);
    expect(t.state.page).toBe(0);
    expect(teams(t)).toEqual(["T01", "T02", "T03", "T04"]);
    t.setExternalFilter(fewWins);
    t.setGlobalFilter("T0");
    expect(t.filteredCount).toBe(4);
    t.setExternalFilter(null);
    expect(t.filteredCount).toBe(9);
    expect(events).toEqual(["change", "change", "change", "change"]);
  });
  test("an external filter that empties the table leaves pageCount 1 and page 0", () => {
    const t = createTable(spec, many, { pageSize: 10 });
    t.setPage(2);
    t.setExternalFilter(() => false);
    expect(t.filteredCount).toBe(0);
    expect(t.rows).toEqual([]);
    expect(t.pageCount).toBe(1);
    expect(t.state.page).toBe(0);
  });
  test("duplicate rowKey values warn once at construction, naming the key and the count", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const t = createTable(keyed, [...rows, rows[0] as Standing, rows[1] as Standing]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toMatch(/"team"/);
      expect(warn.mock.calls[0]?.[0]).toMatch(/2 duplicate/);
      t.setSort("wins", "asc");
      t.setSelection(new Set(["KC"]));
      expect(warn).toHaveBeenCalledTimes(1);
      createTable(keyed, rows);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
  test("setSelection emits one select event with a copy; equal sets are silent; unknown ids are kept", () => {
    const t = createTable(keyed, rows);
    const seen: unknown[] = [];
    t.subscribe((e) => seen.push(e));
    const ids = new Set(["KC", "SEA"]); // SEA is not an AFC row
    t.setSelection(ids);
    t.setSelection(new Set(["SEA", "KC"]));
    ids.add("BUF");
    expect(seen).toEqual([{ type: "select", ids: new Set(["KC", "SEA"]) }]);
    expect(t.getSelection()).toEqual(new Set(["KC", "SEA"]));
    expect(t.state.selection).toBe(t.getSelection());
  });
  test("setHover emits hover without a new snapshot; the same id twice is silent", () => {
    const t = createTable(keyed, rows);
    const seen: unknown[] = [];
    t.subscribe((e) => seen.push(e));
    const snap = t.getSnapshot();
    t.setHover("KC");
    t.setHover("KC");
    t.setHover(null);
    expect(seen).toEqual([
      { type: "hover", id: "KC" },
      { type: "hover", id: null },
    ]);
    expect(t.getSnapshot()).toBe(snap);
  });
});
