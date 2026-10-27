// @vitest-environment jsdom
import {
  InputError,
  contrast,
  onColor,
  preloadAll,
  resetWarnings,
  setWarningHandler,
  solid,
} from "@sportsdataverse/sdvplot";
import { teamColorPalette } from "@sportsdataverse/sdvplot/tanstack";
import {
  AllCommunityModule,
  type GridApi,
  type GridOptions,
  type Theme,
  type ThemeDefaultParams,
  createGrid,
  themeQuartz,
} from "ag-grid-community";
import { afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import { gridOptions } from "../../src/aggrid.js";
import { defineTable } from "../../src/define.js";
import { prepare, renderHTML } from "../../src/html/index.js";
import type { TableSpec } from "../../src/spec.js";
import { resolveTheme } from "../../src/themes/index.js";
import { STANDINGS, type Standing } from "../fixtures/standings.js";

const warnings: string[] = [];
const apis: GridApi[] = [];
beforeAll(async () => {
  await preloadAll();
});
beforeEach(() => {
  warnings.length = 0;
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
});
afterEach(() => {
  for (const a of apis.splice(0)) a.destroy();
  document.body.replaceChildren();
});

/** A real AG Grid (community modules only), every row and column rendered (jsdom has no layout to virtualise by). */
async function grid<Row extends object>(
  options: GridOptions<Row>,
  extra: GridOptions<Row> = {},
): Promise<{ el: HTMLElement; api: GridApi<Row> }> {
  const el = document.body.appendChild(document.createElement("div"));
  let api: GridApi<Row> | undefined;
  await new Promise<void>((done) => {
    api = createGrid(
      el,
      {
        ...options,
        ...extra,
        suppressRowVirtualisation: true,
        suppressColumnVirtualisation: true,
        onFirstDataRendered: () => done(),
      },
      { modules: [AllCommunityModule] },
    );
  });
  apis.push(api as GridApi);
  return { el, api: api as GridApi<Row> };
}
/** Row id -> [col id -> the cell element] for every rendered body row, in display order (AG Grid's row-index). */
function cells(el: HTMLElement): { id: string; row: HTMLElement; cell: Map<string, HTMLElement> }[] {
  return Array.from(el.querySelectorAll<HTMLElement>(".ag-row[row-id]"))
    .sort((a, b) => Number(a.getAttribute("row-index")) - Number(b.getAttribute("row-index")))
    .map((row) => ({
      id: row.getAttribute("row-id") ?? "",
      row,
      cell: new Map(
        Array.from(row.querySelectorAll<HTMLElement>(".ag-cell[col-id]")).map((c) => [
          c.getAttribute("col-id") ?? "",
          c,
        ]),
      ),
    }));
}
/** The HTML table's text for (row, column), which the grid's must equal. */
function htmlTable<Row>(spec: TableSpec<Row>, rows: readonly Row[]) {
  const doc = new DOMParser().parseFromString(renderHTML(spec, rows, { css: "none" }), "text/html");
  return {
    cell: (row: number, key: string) =>
      doc.querySelector(`tr[data-row="${row}"] td[data-col="${key}"]`) as Element,
    label: (key: string) => doc.querySelector(`th[data-col="${key}"]`)?.textContent?.trim() ?? "",
  };
}

test("a real createGrid: one row per input row, by id; each row's logo is its own team's; numbers read as the HTML table's", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.logo("team", { league: "nfl", label: "", height: 28 }),
      c.text("qb"),
      c.int("wins"),
      c.int("pf"),
      c.num("net_epa", { digits: 3, forceSign: true }),
      c.rank("srs_rank", { superscript: false }),
    ])
    .theme("sdv")
    .rowKey("team")
    .build();
  await prepare(spec);
  const { el } = await grid(gridOptions(spec, STANDINGS, { theme: themeQuartz }));
  const rows = cells(el);
  expect(rows.map((r) => r.id)).toEqual(STANDINGS.map((s) => s.team));
  // exactly one image per row, and the ids the logos stand for, in row order
  // (ESPN: KC 12, LAC 24, DEN 7, LV 13, BUF 2, MIA 15, NYJ 20, NE 17)
  expect(rows.map((r) => r.row.querySelectorAll("img").length)).toEqual(STANDINGS.map(() => 1));
  expect(rows.map((r) => r.cell.get("team")?.querySelector("img")?.dataset.sdvId)).toEqual([
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
  for (const [i, s] of STANDINGS.entries()) {
    const img = rows[i]?.cell.get("team")?.querySelector("img");
    expect(img?.getAttribute("src"), s.team).toMatch(/^https:\/\/.+\.(png|svg)$/);
    expect(img?.getAttribute("height")).toBe("28");
    expect(img?.getAttribute("alt"), s.team).not.toBe("");
    // every text and number cell is the HTML table's text for the same row and column
    for (const k of ["qb", "wins", "pf", "net_epa", "srs_rank"])
      expect(rows[i]?.cell.get(k)?.textContent, `${s.team} ${k}`).toBe(html.cell(i, k).textContent);
  }
  const byTeam = new Map(rows.map((r) => [r.id, r.cell]));
  expect(byTeam.get("LV")?.get("net_epa")?.textContent).toBe("−0.146"); // U+2212, as the HTML table
  expect(byTeam.get("NE")?.get("net_epa")?.textContent).toBe(""); // blanked in the fixture: empty, never "NaN" or 0
  expect(warnings).toEqual([]);
});

test("numeric team ids (as numbers and as strings) draw the same logos as abbreviations, in the right rows", async () => {
  type R = { id: number; espn: number | string; wins: number };
  // ESPN ids of KC, BUF, BAL and DET, two as numbers and two as strings
  const rows: R[] = [
    { id: 1, espn: 12, wins: 15 },
    { id: 2, espn: "2", wins: 13 },
    { id: 3, espn: 33, wins: 12 },
    { id: 4, espn: "8", wins: 15 },
  ];
  const spec = defineTable<R>()
    .columns((c) => [c.logo("espn", { league: "nfl" }), c.int("wins")])
    .theme("booktabs")
    .rowKey("id")
    .build();
  await prepare(spec);
  const abbr = defineTable<{ t: string }>()
    .columns((c) => [c.logo("t", { league: "nfl" })])
    .theme("booktabs")
    .build();
  const abbrRows = ["KC", "BUF", "BAL", "DET"].map((t) => ({ t }));
  const want = cells((await grid(gridOptions(abbr, abbrRows))).el).map((r) =>
    r.cell.get("t")?.querySelector("img")?.getAttribute("src"),
  );
  const got = cells((await grid(gridOptions(spec, rows))).el);
  expect(got.map((r) => r.id)).toEqual(["1", "2", "3", "4"]);
  expect(got.map((r) => r.cell.get("espn")?.querySelector("img")?.dataset.sdvId)).toEqual([
    "12",
    "2",
    "33",
    "8",
  ]);
  expect(got.map((r) => r.cell.get("espn")?.querySelector("img")?.getAttribute("src"))).toEqual(want);
  expect(want.every((u) => typeof u === "string")).toBe(true);
});

test("team rows: each row's inline fill is its team's palette colour over the theme, its text 4.5:1, hover and selected shades kept", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("wins")])
    .theme("midnight")
    .rowKey("team")
    .build();
  await prepare(spec);
  const bg = resolveTheme(spec.theme).tokens.bg;
  const o = gridOptions(spec, STANDINGS, { teamRows: { key: "team", league: "nfl" } });
  const palette = teamColorPalette(
    "nfl",
    STANDINGS.map((s) => s.team),
    { background: bg },
  );
  const { el } = await grid(o);
  const rows = cells(el);
  for (const [i, s] of STANDINGS.entries()) {
    const fill = solid(`${palette[i]}66`, bg); // alpha 0.4 = 0x66
    const st = rows[i]?.row.style as CSSStyleDeclaration;
    expect(st.getPropertyValue("background-color"), s.team).toBe(rgb(fill));
    const ink = st.getPropertyValue("color");
    expect(ink).toBe(rgb(onColor(fill)));
    expect(contrast(onColor(fill), fill), s.team).toBeGreaterThanOrEqual(4.5);
    // AG Grid paints its hover and selected overlays from these row variables: a shade of the fill, never its grey
    expect(st.getPropertyValue("--ag-data-background-color")).toBe(fill);
    for (const v of ["--ag-row-hover-color", "--ag-selected-row-background-color"]) {
      const shade = st.getPropertyValue(v);
      expect(shade, `${s.team} ${v}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(shade).not.toBe(fill);
      expect(contrast(onColor(fill), shade), `${s.team} ${v}`).toBeGreaterThanOrEqual(
        contrast(onColor(fill), fill),
      );
    }
  }
  // a row whose team is not found keeps the theme
  expect(o.getRowStyle({ data: { ...STANDINGS[0], team: "ZZZ" } } as never)).toBeUndefined();
});

test("team colour cells: teamColorBg fills and teamColorBar bars sit on their teams' cells; an unknown team takes naColor", async () => {
  type R = { team: string; t2: string; w: number };
  const rows: R[] = [
    { team: "KC", t2: "KC", w: 15 },
    { team: "XXX", t2: "XXX", w: 0 },
    { team: "BUF", t2: "BUF", w: 13 },
  ];
  const spec = defineTable<R>()
    .columns((c) => [
      c.teamColorBg("team", { league: "nfl", alpha: 1 }),
      c.teamColorBar("t2", { league: "nfl", barWidth: 6 }),
      c.int("w"),
    ])
    .theme("sdv")
    .rowKey("team")
    .build();
  await prepare(spec);
  const [kc, buf] = teamColorPalette("nfl", ["KC", "BUF"], { background: "#ffffff" });
  const got = cells((await grid(gridOptions(spec, rows))).el);
  expect(got.map((r) => r.cell.get("team")?.style.backgroundColor)).toEqual([
    rgb(kc as string),
    rgb("#b3b3b3"), // the column's naColor, as the HTML table
    rgb(buf as string),
  ]);
  expect(got.map((r) => r.cell.get("team")?.style.color)).toEqual(
    [kc, "#b3b3b3", buf].map((c) => rgb(onColor(c as string))),
  );
  expect(got.map((r) => r.cell.get("t2")?.style.borderLeft)).toEqual(
    [kc, "#b3b3b3", buf].map((c) => `6px solid ${rgb(c as string)}`),
  );
  expect(got.map((r) => r.cell.get("w")?.style.backgroundColor)).toEqual(["", "", ""]);
  expect(warnings.filter((w) => /XXX/.test(w))).toHaveLength(1); // sdvplot warns once per unknown value
});

test("headshots: each player's ESPN headshot in its own row, decorative; a gsis id resolves, an unknown one keeps its text", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.headshot("qb_espn_id", { league: "nfl", label: "", height: 40 }), c.text("qb")])
    .theme("booktabs")
    .rowKey("qb_espn_id")
    .build();
  await prepare(spec);
  const got = cells((await grid(gridOptions(spec, STANDINGS))).el);
  expect(got.map((r) => r.id)).toEqual(STANDINGS.map((s) => s.qb_espn_id));
  for (const [i, s] of STANDINGS.entries()) {
    const img = got[i]?.cell.get("qb_espn_id")?.querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${s.qb_espn_id}.png`,
    );
    expect(img?.dataset.sdvId).toBe(s.qb_espn_id);
    expect(img?.getAttribute("alt")).toBe(""); // the player's name is in the row
    expect(got[i]?.cell.get("qb")?.textContent).toBe(s.qb);
  }
  const gs = defineTable<{ p: string }>()
    .columns((c) => [c.headshot("p", { league: "nfl", idSystem: "gsis" })])
    .theme("booktabs")
    .build();
  await prepare(gs);
  const g = cells(
    (await grid(gridOptions(gs, [{ p: "00-0033873" }, { p: "00-9999999" }, { p: "00-9999999" }]))).el,
  );
  expect(g[0]?.cell.get("p")?.querySelector("img")?.getAttribute("src")).toMatch(/^https:\/\//);
  expect(g[1]?.cell.get("p")?.querySelector("img")).toBeNull();
  expect(g[1]?.cell.get("p")?.textContent).toBe("00-9999999");
  expect(warnings.filter((w) => /00-9999999/.test(w))).toHaveLength(1);
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
    .theme("sdv")
    .rowKey("n")
    .build();
  await prepare(spec);
  const got = cells((await grid(gridOptions(spec, rows))).el);
  const shown = got.map((r) => {
    const c = r.cell.get("team");
    return c?.querySelector("img") ? "img" : c?.textContent;
  });
  expect(shown).toEqual(["DEL", "img", "DEL", "ZZZ", "ZZZ"]);
  expect(warnings.filter((w) => /logo/.test(w))).toHaveLength(1); // Delaware: no logo archived
  expect(warnings.filter((w) => /ZZZ/.test(w))).toHaveLength(1);
  expect(warnings).toHaveLength(2);
});

test("sorting: sdvtables' comparator, a blank number missing (never 0) and last in both directions, through AG Grid's own sort", async () => {
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
  const { el, api } = await grid(gridOptions(spec, rows));
  const order = (sort: "asc" | "desc") => {
    api.applyColumnState({ state: [{ colId: "n", sort }], defaultState: { sort: null } });
    return cells(el).map((r) => `${r.id}:${r.cell.get("n")?.textContent}`);
  };
  expect(order("asc")).toEqual(["c:1", "f:2", "a:3", "b:", "d:", "e:"]);
  expect(order("desc")).toEqual(["a:3", "f:2", "c:1", "b:", "d:", "e:"]);
});

test("filters: with filtering on, a number column filters as numbers (blank values never match), a text column as text", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("wins"), c.num("net_epa", { digits: 3 })])
    .theme("sdv")
    .rowKey("team")
    .build();
  const { api } = await grid(gridOptions(spec, STANDINGS), { defaultColDef: { filter: true } });
  const shown = () => {
    const ids: string[] = [];
    api.forEachNodeAfterFilter((n) => ids.push(n.id ?? ""));
    return ids;
  };
  api.setFilterModel({ wins: { filterType: "number", type: "greaterThan", filter: 10 } });
  expect(shown()).toEqual(STANDINGS.filter((s) => s.wins > 10).map((s) => s.team));
  api.setFilterModel({ net_epa: { filterType: "number", type: "lessThan", filter: 0 } });
  // New England's blank net EPA is missing, not 0: it is not "less than 0"
  expect(shown()).toEqual(["LV", "MIA", "NYJ"]);
  api.setFilterModel({ team: { filterType: "text", type: "startsWith", filter: "N" } });
  expect(shown()).toEqual(["NYJ", "NE"]);
});

test("formats match the HTML table: scaleNote's divisor, decimals and label suffix, and superscript ranks", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("pf"), c.num("pa"), c.rank("srs_rank")])
    .scaleNote(["pf", "pa"], { divisor: 1000, decimals: 2, where: "both" })
    .theme("sdv")
    .rowKey("team")
    .build();
  await prepare(spec);
  const html = htmlTable(spec, STANDINGS);
  const o = gridOptions(spec, STANDINGS);
  expect(o.columnDefs.map((c) => c.headerName)).toEqual(["team", "pf", "pa", "srs_rank"].map(html.label));
  const got = cells((await grid(o)).el);
  for (const [i, s] of STANDINGS.entries()) {
    for (const k of ["pf", "pa", "srs_rank"])
      expect(got[i]?.cell.get(k)?.textContent, `${s.team} ${k}`).toBe(html.cell(i, k).textContent);
    expect(got[i]?.cell.get("srs_rank")?.querySelector("sup")?.textContent).toBe(
      html.cell(i, "srs_rank").querySelector("sup")?.textContent,
    );
  }
  expect(got[0]?.cell.get("pf")?.textContent).toBe("0.39"); // 385 / 1000, 2 decimals
  expect(warnings).toEqual([]);
});

test("theme: sdv, midnight and booktabs tokens become AG Grid theme params over the base passed in; density is the row height", () => {
  for (const [name, density, height] of [
    ["sdv", "comfortable", 42],
    ["midnight", "compact", 32],
    ["booktabs", "social", 52],
  ] as const) {
    const spec = defineTable<Standing>()
      .columns((c) => [c.text("team")])
      .theme(name, { density })
      .build();
    const t = resolveTheme(spec.theme).tokens;
    let params: Partial<ThemeDefaultParams> | undefined;
    const theme = themeQuartz.withParams({});
    const base = {
      ...theme,
      withParams: (p: Partial<ThemeDefaultParams>) => {
        params = p;
        return theme;
      },
    } as Theme<ThemeDefaultParams>;
    const o = gridOptions(spec, STANDINGS, { theme: base });
    expect(o.theme).toBe(theme);
    const bg = t.bg === "transparent" ? "#ffffff" : t.bg.toLowerCase();
    expect(params, name).toMatchObject({
      backgroundColor: bg,
      foregroundColor: t.text,
      cellTextColor: t.text,
      borderColor: t.rule,
      headerFontFamily: t.fontLabel,
      headerFontWeight: t.labelWeight,
      fontFamily: t.fontBody,
      fontSize: t.bodySize,
      browserColorScheme: name === "midnight" ? "dark" : "light",
    });
    expect(contrast(params?.foregroundColor as string, params?.backgroundColor as string)).toBeGreaterThan(
      4.5,
    );
    expect(o.rowHeight).toBe(height);
  }
  // no base theme passed: the grid keeps its own
  const plain = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .build();
  expect("theme" in gridOptions(plain, STANDINGS)).toBe(false);
});

test("stripes: a striped theme's stripe is AG Grid's odd-row colour; a team row's inline fill wins over it", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .theme("savant")
    .rowKey("team")
    .build();
  const t = resolveTheme(spec.theme).tokens;
  expect(t.stripe).not.toBe("transparent");
  let params: Partial<ThemeDefaultParams> = {};
  const base = {
    withParams: (p: typeof params) => {
      params = p;
      return themeQuartz;
    },
  } as never;
  gridOptions(spec, STANDINGS, { theme: base });
  expect(params.oddRowBackgroundColor).toBe(t.stripe);
  const { el } = await grid(gridOptions(spec, STANDINGS, { teamRows: { key: "team", league: "nfl" } }));
  const odd = cells(el)[1]?.row as HTMLElement;
  expect(odd.classList.contains("ag-row-odd")).toBe(true);
  expect(odd.style.backgroundColor).not.toBe(""); // inline beats .ag-row-odd's class rule
});

test("columns: labels, right alignment, px widths, number filters, header tooltips; unmapped kinds plain (one warning)", () => {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.text("team", { label: "Team", width: "120px", subheader: "2024" }),
      c.int("wins", { width: "8em" }),
      c.pct("net_epa", { digits: 1, scale: true }),
      c.colorPills("pf"),
      c.colorPills("pa"),
    ])
    .theme("sdv")
    .build();
  const o = gridOptions(spec, STANDINGS);
  const [team, wins, pct, pill] = o.columnDefs;
  expect(team).toMatchObject({ headerName: "Team", width: 120, headerTooltip: "2024", cellDataType: false });
  expect(wins).toMatchObject({
    cellDataType: "number",
    headerClass: "ag-right-aligned-header",
    cellStyle: { textAlign: "right" },
  });
  // filtering is the spec's (or the grid's) to turn on: no filter, so no filter button, unless asked for
  expect(o.columnDefs.map((c) => c.filter)).toEqual(o.columnDefs.map(() => undefined));
  expect(wins?.width).toBeUndefined();
  const fmt = pct?.valueFormatter as (p: { value: unknown }) => string;
  expect([0.063, -0.146, null].map((value) => fmt({ value }))).toEqual(["6.3%", "−14.6%", ""]);
  expect(pill?.cellRenderer).toBeUndefined();
  expect(warnings.filter((w) => /width/.test(w))).toHaveLength(1);
  expect(warnings.filter((w) => /colorPills/.test(w))).toHaveLength(1); // two pills columns, one warning
});

test("row ids: the index without a rowKey; a repeated row, a repeated or blank rowKey value throws; rows fit the images", () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.headshot("qb_espn_id", { league: "nfl", height: 60 })])
    .theme("sdv", { density: "compact" })
    .build();
  const o = gridOptions(spec, STANDINGS);
  expect(STANDINGS.map((data) => o.getRowId({ data } as never))).toEqual(STANDINGS.map((_, i) => String(i)));
  expect(() => o.getRowId({ data: { ...STANDINGS[0] } } as never)).toThrow(/rowKey/);
  expect(o.rowHeight).toBe(68); // 60 px headshot + 8
  const row = STANDINGS[0] as Standing;
  expect(() => gridOptions(spec, [row, row])).toThrow(InputError);
  const keyed = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .rowKey("team")
    .build();
  expect(() => gridOptions(keyed, [row, { ...row }])).toThrow(/same rowKey "team" value "KC"/);
  expect(() => gridOptions(keyed, [{ ...row, team: " " }])).toThrow(InputError);
  expect(gridOptions(keyed, STANDINGS).getRowId({ data: { ...row, team: "XYZ" } } as never)).toBe("XYZ");
});

test("community only: no enterprise option in what gridOptions returns, and a grid with only AllCommunityModule logs no error", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.logo("team", { league: "nfl" }), c.int("wins"), c.rank("srs_rank")])
    .theme("midnight")
    .rowKey("team")
    .build();
  await prepare(spec);
  const o = gridOptions(spec, STANDINGS, { theme: themeQuartz, teamRows: { key: "team", league: "nfl" } });
  // AG Grid Enterprise's features, as grid and column options (row grouping, pivot, aggregation, Excel, set and multi
  // filters, master detail, integrated charts, range selection, side bar, status bar, tree data, server-side rows)
  const ENTERPRISE =
    /^(rowGroup|rowGroupIndex|enableRowGroup|pivot|pivotIndex|enablePivot|pivotMode|aggFunc|enableValue|allowedAggFuncs|masterDetail|detailCellRenderer|enableCharts|cellSelection|enableRangeSelection|sideBar|statusBar|treeData|excelStyles|rowModelType|groupDisplayType|autoGroupColumnDef|chartToolPanelsDef)$/;
  const keys = [...Object.keys(o), ...o.columnDefs.flatMap((c) => Object.keys(c))];
  expect(keys.filter((k) => ENTERPRISE.test(k))).toEqual([]);
  const filters = o.columnDefs.map((c) => c.filter).filter((f) => typeof f === "string");
  expect(filters.filter((f) => !/^ag(Text|Number|Date)ColumnFilter$/.test(f as string))).toEqual([]);
  // AG Grid logs an error (#200 and the like) when an option needs a module that is not registered
  const logged: string[] = [];
  const [error, warn] = [console.error, console.warn];
  console.error = (...a: unknown[]) => logged.push(a.join(" "));
  console.warn = (...a: unknown[]) => logged.push(a.join(" "));
  try {
    const { el } = await grid(o);
    expect(cells(el)).toHaveLength(STANDINGS.length);
  } finally {
    console.error = error;
    console.warn = warn;
  }
  expect(logged.filter((m) => /AG Grid/i.test(m))).toEqual([]);
});

/** Chromium and jsdom report an inline colour as rgb(r, g, b). */
function rgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
}
