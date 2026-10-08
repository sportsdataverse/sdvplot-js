import { preloadAll, setWarningHandler } from "@sportsdataverse/sdvplot";
// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { defineTable } from "../../src/define.js";
import { type Table, createTable } from "../../src/engine.js";
import { renderHTML } from "../../src/html/index.js";
import { SdvTable, useTable } from "../../src/react/index.js";
import type { TableSpec } from "../../src/spec.js";
import { THEME_NAMES } from "../../src/themes/index.js";
import { many, rows, spec } from "../fixtures/engine.js";
import { STANDINGS, type Standing } from "../fixtures/standings.js";

beforeAll(async () => {
  setWarningHandler(() => {});
  await preloadAll();
});
afterEach(cleanup); // no vitest globals, so RTL cannot register its own cleanup

/** STANDINGS plus copies of real columns, so each of the 21 kinds gets a key of its own (keys are unique). */
type Wide = Standing & {
  logo_team: string;
  wordmark_team: string;
  bar_team: string;
  bg_team: string;
  qb_img: string;
  epa_pct: number | null;
  wins_pills: number;
  srs_ranks: number;
  pf_bar: number;
};
const WIDE: readonly Wide[] = STANDINGS.map((r) => ({
  ...r,
  logo_team: r.team,
  wordmark_team: r.team,
  bar_team: r.team,
  bg_team: r.team,
  qb_img: r.qb_espn_id,
  epa_pct: r.net_epa,
  wins_pills: r.wins,
  srs_ranks: r.srs_rank,
  pf_bar: r.pf,
}));
/** Every one of the 21 column kinds. */
const KINDS = defineTable<Wide>()
  .columns((c) => [
    c.text("team", { filterable: true }),
    c.num("pa", { digits: 1 }),
    c.int("wins"),
    c.pct("epa_pct"),
    c.rank("srs_rank"),
    c.delta("pf", "pa"),
    c.tally(["losses", "ties"]),
    c.logo("logo_team", { league: "nfl" }),
    c.wordmark("wordmark_team", { league: "nfl" }),
    c.headshot("qb_espn_id", { league: "nfl" }),
    c.colorPills("wins_pills", { digits: 0 }),
    c.colorRanks("srs_ranks"),
    c.colorResults("result_last"),
    c.percentileBar("pf_bar", { domain: [0, 600] }),
    c.indicatorBox("ties", { truthy: [0] }),
    c.highlight("conf", { key: "wins", op: ">=", value: 13 }),
    c.highlightNa("net_epa", { missingText: "n/a", italic: true }),
    c.mergeStackTeamColor("qb", "division", "team", { league: "nfl" }),
    c.teamColorBar("bar_team", { league: "nfl" }),
    c.teamColorBg("bg_team", { league: "nfl", alpha: 0.5 }),
    c.image("qb_img", { height: "20px" }),
  ])
  .build();
/** Head, row, legend and foot decorations together (no snake: an interactive table rejects it). */
const DECORATED = defineTable<Standing>()
  .columns((c) => [
    c.text("team", { filterable: true }),
    c.text("qb", { filterable: true }),
    c.colorPills("wins", { digits: 0 }),
    c.int("pf"),
    c.num("net_epa", { digits: 3 }),
  ])
  .title("AFC standings")
  .subtitle("2024 regular season")
  .borderBars("top", ["#e31837", "#ffb81c"], { text: "AFC" })
  .watermark({ text: "DRAFT", angle: -30 })
  .font("Inter", { weight: 600 })
  .cutline(3, { label: ["Playoff line"] })
  .boldRows({ key: "wins", op: ">=", value: 13 })
  .rowAccent("division", { palette: ["#111111", "#222222"], hide: false })
  .legendContinuous()
  .legendDiscrete({ West: "#111111", East: "#222222" })
  .outliers(["pf"], { method: "iqr", threshold: 1.0, symbol: "†" })
  .marginalia(["qb"], { label: "Signal caller" })
  .scaleNote(["pf"], { divisor: 10, decimals: 1 })
  .socialTag({ x: "SportsDataverse", gh: "sportsdataverse" })
  .wrapLabels({ width: 10 })
  .borderGrid()
  .sourceNote("Source: nflverse")
  .build();
const GROUPED = defineTable<Standing>()
  .columns((c) => [c.text("team", { filterable: true }), c.int("wins"), c.colorRanks("srs_rank")])
  .groupBy("division")
  .groupStripes()
  .build();

/** The SSR of `<SdvTable table={t} interactive/>` and `renderHTML(t, { fonts: false })`, for one engine state. */
function both<Row>(t: Table<Row>): [string, string] {
  return [
    renderToStaticMarkup(<SdvTable spec={t.spec} rows={t.allRows} table={t} interactive />),
    renderHTML(t, { fonts: false }),
  ];
}
test("SSR of <SdvTable/> equals renderHTML(spec, rows, { fonts: false }) byte-for-byte (spec §6.3)", () => {
  expect(renderToStaticMarkup(<SdvTable spec={spec} rows={rows} />)).toBe(
    renderHTML(spec, rows, { fonts: false }),
  );
  expect(renderToStaticMarkup(<SdvTable spec={spec} rows={rows} css="none" />)).toBe(
    renderHTML(spec, rows, { css: "none", fonts: false }),
  ); // css "none" alone keeps the fonts link (Phase 4 A98)
});
test("SSR of interactive <SdvTable/> equals renderHTML(createTable(...), { fonts: false })", () => {
  const t = createTable(spec, many, { pageSize: 10, sort: { col: "wins", dir: "desc" } });
  expect(
    renderToStaticMarkup(
      <SdvTable spec={spec} rows={many} interactive pageSize={10} sort={{ col: "wins", dir: "desc" }} />,
    ),
  ).toBe(renderHTML(t, { fonts: false }));
});
test("escaping parity on hostile data", () => {
  const hostile = [{ ...(STANDINGS[0] as Standing), qb: `<img src=x onerror=alert(1)> O'Neal & "Shaq"` }];
  expect(renderToStaticMarkup(<SdvTable spec={spec} rows={hostile} />)).toBe(
    renderHTML(spec, hostile, { fonts: false }),
  );
  const t = createTable(spec, hostile);
  t.setGlobalFilter(`O'Neal & "`); // a typed value lands in the input's value attribute
  expect(renderToStaticMarkup(<SdvTable spec={spec} rows={hostile} table={t} interactive />)).toBe(
    renderHTML(t, { fonts: false }),
  );
});
test("SSR equality, all 21 column kinds on STANDINGS: static, and interactive with pager, sort, filters and a selection", () => {
  expect(new Set(KINDS.columns.map((c) => c.kind)).size).toBe(21);
  expect(renderToStaticMarkup(<SdvTable spec={KINDS} rows={WIDE} />)).toBe(
    renderHTML(KINDS, WIDE, { fonts: false }),
  );
  const t = createTable(KINDS, WIDE, { pageSize: 2, sort: { col: "wins", dir: "desc" } });
  t.setFilter("team", "n"); // DEN NYJ NE
  t.setPage(1);
  t.setSelection(new Set([t.rowId(WIDE[7] as Wide)])); // NE, alone on the last page
  t.setCursor(0, "srs_ranks"); // fix 1 (I2): the cursor column's aria-current
  const [react, html] = both(t);
  expect(html).toContain('data-col="srs_ranks" data-kind="colorRanks" aria-current="true"');
  expect(html).toContain('class="sdvt-toolbar"');
  expect(html).toContain(" sdvt-selected");
  expect(html).toContain('aria-sort="descending"');
  expect(html).toContain('aria-label="Next page" aria-disabled="true"');
  expect(html).toContain("Page 2 of 2");
  expect(react).toBe(html);
});
test("SSR equality with decorations: static and interactive (renamed filter label, legends, cutline, outliers, notes)", () => {
  expect(renderToStaticMarkup(<SdvTable spec={DECORATED} rows={STANDINGS} />)).toBe(
    renderHTML(DECORATED, STANDINGS, { fonts: false }),
  );
  const t = createTable(DECORATED, STANDINGS, { pageSize: 3, sort: { col: "wins", dir: "desc" } });
  t.setFilter("qb", "a"); // six quarterbacks: two pages
  t.setSelection(new Set([t.rowId(STANDINGS[0] as Standing)])); // KC, first on page 1
  const [react, html] = both(t);
  expect(html).toContain("Filter Signal caller");
  expect(html).toContain('aria-label="Previous page" aria-disabled="true"');
  expect(html).toContain("sdvt-legend");
  expect(html).toContain(" sdvt-selected");
  expect(react).toBe(html);
  t.setPage(1);
  t.setGlobalFilter("o");
  expect(both(t)[0]).toBe(both(t)[1]);
});
test("SSR equality with groupBy and a hidden column (its filter input leaves the toolbar)", () => {
  expect(renderToStaticMarkup(<SdvTable spec={GROUPED} rows={STANDINGS} />)).toBe(
    renderHTML(GROUPED, STANDINGS, { fonts: false }),
  );
  const t = createTable(GROUPED, STANDINGS, { pageSize: 5 });
  t.setSelection(new Set(["1", "4"]));
  expect(both(t)[0]).toBe(both(t)[1]);
  t.toggleColumn("team");
  const [react, html] = both(t);
  expect(html).not.toContain("data-sdv-filter");
  expect(react).toBe(html);
});
test("SSR equality under every theme, static and interactive", () => {
  for (const name of THEME_NAMES) {
    const s: TableSpec<Standing> = {
      ...spec,
      theme: { name, density: "compact", ...(name === "sdvTeam" ? { options: { league: "nfl" } } : {}) },
    };
    expect(renderToStaticMarkup(<SdvTable spec={s} rows={STANDINGS} />), name).toBe(
      renderHTML(s, STANDINGS, { fonts: false }),
    );
    const t = createTable(s, STANDINGS, { pageSize: 4 });
    t.setSort("net_epa", "asc");
    t.setCursor(2, "net_epa"); // fix 1 (I2): aria-current on the sorted header, beside aria-sort
    const [react, html] = both(t);
    expect(html, name).toContain('aria-current="true" aria-sort="ascending"');
    expect(react, name).toBe(html);
  }
});
test("interactive table sorts, pages and filters in the browser; the filter input keeps focus", () => {
  render(<SdvTable spec={spec} rows={many} interactive pageSize={10} />);
  const first = (): string | null =>
    document.querySelector("[data-sdv-body] tbody tr td")?.textContent ?? null;
  expect(first()).toBe("ARI");
  fireEvent.click(screen.getByRole("button", { name: "Wins" }));
  fireEvent.click(screen.getByRole("button", { name: "Wins" }));
  expect(first()).toBe("DET"); // 15 wins, as KC: the tie keeps input order
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByText("Page 2 of 4")).toBeTruthy();
  const input = screen.getByLabelText("Filter Team") as HTMLInputElement;
  input.focus();
  fireEvent.input(input, { target: { value: "n" } }); // CIN DEN IND MIN NE NO NYG NYJ TEN
  expect(document.querySelectorAll("[data-sdv-body] tbody tr").length).toBe(9);
  expect(screen.getByText("Page 1 of 1")).toBeTruthy();
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("n");
  fireEvent.input(screen.getByLabelText("Search all columns"), { target: { value: "Mahomes" } });
  expect(document.querySelectorAll("[data-sdv-body] tbody tr").length).toBe(0); // KC has no "n"
});
test("A50: Next keeps focus to the last page, the edge click is a no-op, the label is a polite live region", () => {
  const t = createTable(spec, many, { pageSize: 10 });
  const { container } = render(<SdvTable spec={spec} rows={many} table={t} interactive />);
  const prev = container.querySelector('[data-sdv-page="prev"]') as HTMLButtonElement;
  const next = container.querySelector('[data-sdv-page="next"]') as HTMLButtonElement;
  expect(container.querySelector("[data-sdv-page-label]")?.getAttribute("aria-live")).toBe("polite");
  expect(prev.getAttribute("aria-disabled")).toBe("true");
  next.focus();
  for (let i = 0; i < 3; i++) fireEvent.click(next);
  expect(t.state.page).toBe(3);
  expect(prev.getAttribute("aria-disabled")).toBeNull();
  expect(next.getAttribute("aria-disabled")).toBe("true");
  expect(next.disabled).toBe(false); // a disabled button would drop focus to <body>
  expect(document.activeElement).toBe(next);
  const seen: unknown[] = [];
  t.subscribe((e) => seen.push(e));
  fireEvent.click(next);
  expect(seen).toEqual([]);
  expect(container.querySelector("[data-sdv-page-label]")?.textContent).toBe("Page 4 of 4");
});
test("A50: a keyboard sort keeps focus on the re-rendered sort button (layout-effect restore)", () => {
  const { container } = render(<SdvTable spec={spec} rows={rows} interactive />);
  const old = container.querySelector('[data-sdv-sort="net_epa"]') as HTMLButtonElement;
  old.focus();
  fireEvent.click(old); // Enter or Space on a focused button
  const now = container.querySelector('[data-sdv-sort="net_epa"]');
  expect(now).not.toBe(old); // the table block was rebuilt
  expect(container.querySelector('[data-col="net_epa"]')?.getAttribute("aria-sort")).toBe("ascending");
  expect(document.activeElement).toBe(now);
});
test("A50: a hidden column's filter input leaves and returns with its shown label and value; another input keeps focus", () => {
  const s = defineTable<Standing>()
    .columns((c) => [c.text("team", { filterable: true }), c.text("qb", { filterable: true }), c.int("wins")])
    .marginalia(["qb"], { label: "Signal caller" })
    .build();
  const t = createTable(s, rows);
  const { container } = render(<SdvTable spec={s} rows={rows} table={t} interactive />);
  const qb = (): HTMLInputElement | null => container.querySelector('[data-sdv-filter="qb"]');
  expect(container.querySelector(`label[for="${qb()?.id}"]`)?.textContent).toBe("Filter Signal caller");
  act(() => t.setFilter("qb", "Jo"));
  const team = container.querySelector('[data-sdv-filter="team"]') as HTMLInputElement;
  team.focus();
  act(() => t.toggleColumn("qb"));
  expect(qb()).toBeNull(); // the filter stays active in the engine, with no input
  expect(t.state.filters.qb).toBe("Jo");
  expect(document.activeElement).toBe(team);
  act(() => t.toggleColumn("qb"));
  expect(qb()?.value).toBe("Jo");
  expect(container.querySelector(`label[for="${qb()?.id}"]`)?.textContent).toBe("Filter Signal caller");
  expect(document.activeElement).toBe(team);
});
test("an external setGlobalFilter / setFilter / clear shows in the toolbar inputs (controlled by the engine)", () => {
  const t = createTable(spec, rows);
  const { container } = render(<SdvTable spec={spec} rows={rows} table={t} interactive />);
  const g = container.querySelector("[data-sdv-global-filter]") as HTMLInputElement;
  const f = container.querySelector('[data-sdv-filter="team"]') as HTMLInputElement;
  act(() => {
    t.setGlobalFilter("x");
    t.setFilter("team", "y");
  });
  expect([g.value, f.value]).toEqual(["x", "y"]);
  expect(container.querySelector('[data-sdv-filter="team"]')).toBe(f); // updated in place
  act(() => {
    t.setGlobalFilter("");
    t.setFilter("team", "");
  });
  expect([g.value, f.value]).toEqual(["", ""]);
});
test("useTable re-renders from the external store", () => {
  function Count(): ReactElement {
    const { table, snapshot } = useTable(spec, rows);
    return (
      <button type="button" onClick={() => table.setFilter("team", "l")}>
        {snapshot.filteredCount}
      </button>
    );
  }
  render(<Count />);
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button").textContent).toBe("2");
});
test("J31: <SdvTable table={…}/> renders an external engine; row hover and click reach it; hover never re-renders", () => {
  const t = createTable({ ...spec, rowKey: "team" }, rows);
  const seen: string[] = [];
  t.subscribe((e) => seen.push(e.type === "hover" ? `hover:${e.id}` : e.type));
  const { container } = render(<SdvTable spec={t.spec} rows={rows} table={t} interactive />);
  const kc = container.querySelector<HTMLElement>('[data-sdv-body] tr[data-row="0"]');
  if (!kc) throw new Error("no KC row");
  fireEvent.mouseOver(kc);
  expect(kc.isConnected).toBe(true); // the row under the pointer was not replaced
  fireEvent.click(kc);
  expect(seen).toEqual(["hover:KC", "select"]);
  expect(container.querySelector('tr.sdvt-selected [data-col="team"]')?.textContent).toBe("KC");
  fireEvent.mouseLeave(container.firstElementChild as Element);
  expect(seen.at(-1)).toBe("hover:null");
});
test("J31: leaving <SdvTable/> from a row clears the hover: React's leave event targets that row's cell, not the table", () => {
  // React synthesises mouseleave from mouseout, and the root's leave event keeps the deepest element the pointer left
  const t = createTable({ ...spec, rowKey: "team" }, STANDINGS);
  const { container } = render(<SdvTable spec={t.spec} rows={STANDINGS} table={t} interactive />);
  document.body.append(container);
  const cell = container.querySelector('[data-sdv-body] tr[data-row="0"] td');
  if (!cell) throw new Error("no KC cell");
  fireEvent.mouseOver(cell);
  expect([t.getHover(), container.querySelectorAll("tr.sdvt-hover").length]).toEqual(["KC", 1]);
  fireEvent.mouseOut(cell, { relatedTarget: document.body }); // out of the table, from KC's cell
  expect([t.getHover(), container.querySelectorAll("tr.sdvt-hover").length]).toEqual([null, 0]);
});
test("I1 + M4: a parent re-rendering fresh equal rows and an inline spec keeps sort, filter text, page and selection; new rows show; later pageSize/sort are ignored; a structural spec change rebuilds", () => {
  const Parent = ({
    data,
    pageSize,
    sort,
    narrow = false,
  }: {
    data: readonly Standing[];
    pageSize: number;
    sort?: { col: string; dir: "asc" | "desc" };
    narrow?: boolean;
  }): ReactElement => (
    <SdvTable
      // an explicit id: a structural change must rebuild even though tableId(spec) stays "fixed"
      spec={{ ...spec, id: "fixed", rowKey: "team", ...(narrow && { columns: spec.columns.slice(0, 2) }) }}
      rows={data.map((r) => ({ ...r }))}
      interactive
      pageSize={pageSize}
      {...(sort && { sort })}
    />
  );
  const { container, rerender } = render(<Parent data={many} pageSize={5} />);
  const bodyTeams = (): (string | null)[] =>
    Array.from(container.querySelectorAll('[data-sdv-body] tbody [data-col="team"]'), (e) => e.textContent);
  const filter = (): HTMLInputElement => screen.getByLabelText("Filter Team") as HTMLInputElement;
  fireEvent.click(screen.getByRole("button", { name: "Wins" }));
  fireEvent.click(screen.getByRole("button", { name: "Wins" })); // desc
  filter().focus();
  fireEvent.input(filter(), { target: { value: "n" } }); // MIN DEN CIN IND NO | NYJ NE NYG TEN
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  fireEvent.click(container.querySelector('[data-sdv-body] tr[data-row="2"]') as Element); // NYG
  const kept = (): void => {
    expect(filter().value).toBe("n");
    expect(container.querySelector('th[data-col="wins"]')?.getAttribute("aria-sort")).toBe("descending");
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect(bodyTeams()).toEqual(["NYJ", "NE", "NYG", "TEN"]);
    expect(container.querySelector('tr.sdvt-selected [data-col="team"]')?.textContent).toBe("NYG");
  };
  kept();
  rerender(<Parent data={many} pageSize={10} sort={{ col: "team", dir: "asc" }} />); // fresh rows + spec, new initial props
  kept();
  expect(document.activeElement).toBe(filter());
  rerender(
    <Parent data={many.map((r) => (r.team === "NYG" ? { ...r, qb: "Changed QB" } : r))} pageSize={10} />,
  );
  kept();
  expect(container.querySelector('tr.sdvt-selected [data-col="qb"]')?.textContent).toBe("Changed QB");
  rerender(<Parent data={many} pageSize={10} narrow />); // a different spec: a new engine from the current props
  expect(container.querySelector('th[data-col="qb"]')).toBeNull();
  expect(filter().value).toBe("");
  expect(screen.getByText("Page 1 of 4")).toBeTruthy();
  expect(container.querySelector("tr.sdvt-selected")).toBeNull();
});
test("I2: with table= no owned engine is built; spec and rows are optional, and ignored when passed", () => {
  const t = createTable(spec, many, { pageSize: 10 });
  const watched = [...rows];
  const filter = vi.spyOn(watched, "filter");
  const { container, rerender } = render(<SdvTable table={t} spec={spec} rows={watched} interactive />);
  expect(filter).not.toHaveBeenCalled();
  expect(container.querySelectorAll("[data-sdv-body] tbody tr").length).toBe(10);
  rerender(<SdvTable table={t} interactive />);
  expect(screen.getByText("Page 1 of 4")).toBeTruthy();
});
test("M3: a non-interactive render of table= shows its current (filtered, sorted) rows and follows the engine", () => {
  const t = createTable(spec, rows);
  t.setSort("wins", "desc");
  t.setFilter("team", "n"); // DEN NYJ NE
  const html = renderToStaticMarkup(<SdvTable table={t} spec={spec} rows={rows} />);
  expect(html).toBe(renderHTML(t.spec, t.rows, { fonts: false, domainRows: t.allRows }));
  expect(html).not.toContain(`class="sdvt-toolbar"`);
  expect(html).not.toContain("data-sdv-sort");
  const { container } = render(<SdvTable table={t} />);
  const shown = (): (string | null)[] =>
    Array.from(container.querySelectorAll('tbody [data-col="team"]'), (e) => e.textContent);
  expect(shown()).toEqual(["DEN", "NYJ", "NE"]);
  act(() => t.setFilter("team", "ny"));
  expect(shown()).toEqual(["NYJ"]);
});

test("Task 10: keys drive <SdvTable/>: j moves the tab stop and focus to the rebuilt row, Enter selects, l + s sort, / searches; a letter typed in a box is not a hotkey", () => {
  const { container } = render(<SdvTable spec={spec} rows={rows} interactive />);
  const row = (i: number): HTMLElement =>
    container.querySelector<HTMLElement>(`[data-sdv-body] tr[data-row="${i}"]`) as HTMLElement;
  const first = row(0);
  first.focus();
  expect(fireEvent.keyDown(first, { key: "j" })).toBe(false); // consumed
  expect(row(0)).not.toBe(first); // the table block was rebuilt
  expect(row(0).getAttribute("tabindex")).toBe("-1");
  expect(row(1).getAttribute("tabindex")).toBe("0");
  expect(document.activeElement).toBe(row(1)); // layout-effect restore, by data-row
  fireEvent.keyDown(row(1), { key: "Enter" });
  expect(row(1).getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(row(1));
  fireEvent.keyDown(row(1), { key: "l" });
  fireEvent.keyDown(row(1), { key: "s" });
  expect(container.querySelector('[data-col="wins"]')?.getAttribute("aria-sort")).toBe("ascending");
  const search = screen.getByLabelText("Search all columns");
  expect(fireEvent.keyDown(search, { key: "j" })).toBe(true); // typed into the box: not a hotkey
  fireEvent.keyDown(row(1), { key: "/" });
  expect(document.activeElement).toBe(search);
});
test("Task 10 (A50): SSR equality on a grid: cursor row, current column, a selection, page 2", () => {
  const t = createTable(spec, many, { pageSize: 10 });
  t.setPage(1);
  t.setCursor(3, "wins");
  t.setSelection(new Set(["12"]));
  const [react, html] = both(t);
  expect(html).toContain('<table role="grid" aria-multiselectable="true">');
  expect(html).toContain('data-row="3" tabindex="0" aria-selected="false"');
  expect(html).toContain('data-row="2" tabindex="-1" aria-selected="true"');
  expect(html).toContain(" sdvt-col-current");
  expect(html).toContain('data-col="wins" data-kind="int" aria-current="true"'); // fix 1 (I2)
  expect(react).toBe(html);
});
