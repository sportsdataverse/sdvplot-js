// @vitest-environment jsdom
import { DataGrid, type DataGridProps } from "@mui/x-data-grid";
import {
  InputError,
  contrast,
  preloadAll,
  resetWarnings,
  setWarningHandler,
  solid,
} from "@sportsdataverse/sdvplot";
import { teamColorPalette } from "@sportsdataverse/sdvplot/mui";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import { defineTable } from "../../src/define.js";
import { prepare, renderHTML } from "../../src/html/index.js";
import { dataGridProps } from "../../src/mui.js";
import type { TableSpec } from "../../src/spec.js";
import { resolveTheme } from "../../src/themes/index.js";
import { STANDINGS, type Standing } from "../fixtures/standings.js";

const warnings: string[] = [];
beforeAll(async () => {
  await preloadAll();
});
beforeEach(() => {
  warnings.length = 0;
  resetWarnings();
  setWarningHandler((m) => warnings.push(m));
});
afterEach(cleanup);

function grid<Row extends object>(
  spec: TableSpec<Row>,
  rows: readonly Row[],
  props = dataGridProps(spec, rows),
  extra: Partial<DataGridProps<Row>> = {},
) {
  const { container } = render(
    <div style={{ width: 900 }}>
      <DataGrid rows={rows} {...props} {...extra} disableVirtualization hideFooter />
    </div>,
  );
  return container;
}
/** Row id -> [field -> the cell element] for every rendered body row, in display order. */
function cells(container: HTMLElement): { id: string; cell: Map<string, Element> }[] {
  return Array.from(container.querySelectorAll(".MuiDataGrid-row")).map((row) => ({
    id: row.getAttribute("data-id") ?? "",
    cell: new Map(
      Array.from(row.querySelectorAll(".MuiDataGrid-cell[data-field]")).map((c) => [
        c.getAttribute("data-field") ?? "",
        c,
      ]),
    ),
  }));
}

test("a real DataGrid: one row per input row, numbers in sdvtables' formats, logos in the rows of their teams", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.logo("team", { league: "nfl", label: "", height: 28 }),
      c.text("qb"),
      c.int("pf"),
      c.num("net_epa", { digits: 3, forceSign: true }),
      c.rank("srs_rank"),
    ])
    .theme("sdv")
    .rowKey("team")
    .build();
  await prepare(spec);
  const container = grid(spec, STANDINGS);
  const rows = cells(container);
  expect(rows.map((r) => r.id)).toEqual(STANDINGS.map((s) => s.team));
  for (const [i, s] of STANDINGS.entries()) {
    const r = rows[i]!;
    const img = r.cell.get("team")?.querySelector("img");
    expect(img?.getAttribute("data-sdv-kind"), s.team).toBe("logo");
    expect(img?.getAttribute("src"), s.team).toMatch(/^https:\/\/.+\.(png|svg)$/);
    expect(img?.getAttribute("height")).toBe("28");
    expect(r.cell.get("qb")?.textContent).toBe(s.qb);
    expect(r.cell.get("srs_rank")?.textContent).toMatch(new RegExp(`^${s.srs_rank}(st|nd|rd|th)$`));
  }
  // the team ids the logos stand for, in row order (ESPN: KC 12, LAC 24, DEN 7, LV 13, BUF 2, MIA 15, NYJ 20, NE 17)
  expect(rows.map((r) => r.cell.get("team")?.querySelector("img")?.getAttribute("data-sdv-id"))).toEqual([
    "12",
    "24",
    "7",
    "13",
    "2",
    "15",
    "20",
    "17",
  ]);
  const byTeam = new Map(rows.map((r) => [r.id, r.cell]));
  expect(byTeam.get("BUF")?.get("pf")?.textContent).toBe("525");
  expect(byTeam.get("LV")?.get("net_epa")?.textContent).toBe("−0.146"); // U+2212, as the HTML table
  expect(byTeam.get("DEN")?.get("net_epa")?.textContent).toBe("+0.108");
  expect(byTeam.get("NE")?.get("net_epa")?.textContent).toBe(""); // blanked in the fixture: empty, never "NaN"
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
  const want = cells(grid(abbr, abbrRows)).map((r) =>
    r.cell.get("t")?.querySelector("img")?.getAttribute("src"),
  );
  cleanup();
  const got = cells(grid(spec, rows));
  expect(got.map((r) => r.id)).toEqual(["1", "2", "3", "4"]);
  expect(got.map((r) => r.cell.get("espn")?.querySelector("img")?.getAttribute("data-sdv-id"))).toEqual([
    "12",
    "2",
    "33",
    "8",
  ]);
  expect(got.map((r) => r.cell.get("espn")?.querySelector("img")?.getAttribute("src"))).toEqual(want);
  expect(want.every((u) => typeof u === "string")).toBe(true);
});

test("team rows: each row takes its team's palette colour over the theme background, its text 4.5:1 on it", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("wins")])
    .theme("sdv")
    .rowKey("team")
    .build();
  await prepare(spec);
  const props = dataGridProps(spec, STANDINGS, { teamRows: { key: "team", league: "nfl", alpha: 1 } });
  const palette = teamColorPalette(
    "nfl",
    STANDINGS.map((s) => s.team),
    { background: "#ffffff" },
  );
  const classes = STANDINGS.map((row, i) => props.getRowClassName({ row, indexRelativeToCurrentPage: i }));
  // alpha 1: the fill IS the palette colour; one class per distinct colour, styled in sx
  expect(classes).toEqual(palette.map((c) => `sdvt-fill-${c.slice(1)}`));
  for (const c of classes) {
    const rule = props.sx[`& .${c}`] as { backgroundColor: string; color: string };
    expect(rule.backgroundColor).toBe(`#${c.slice("sdvt-fill-".length)}`);
    expect(contrast(rule.color, rule.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  }
  // the classes reach MUI's rows
  const container = grid(spec, STANDINGS, props);
  expect(
    cells(container).map(
      (r) => container.querySelector(`[data-id="${r.id}"]`)?.className.match(/sdvt-fill-\w+/)?.[0],
    ),
  ).toEqual(classes);
});

test("team colour cells: teamColorBg and teamColorBar classes sit on their teams' cells, styled from the palette", async () => {
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
  const props = dataGridProps(spec, rows);
  const [kc, buf] = teamColorPalette("nfl", ["KC", "BUF"], { background: "#ffffff" });
  const got = cells(grid(spec, rows, props));
  const cls = (r: (typeof got)[number], f: string): string =>
    r.cell.get(f)?.className.match(/sdvt-(fill|bar)-[\w-]+/)?.[0] ?? "";
  expect(got.map((r) => cls(r, "team"))).toEqual([
    `sdvt-fill-${kc?.slice(1)}`,
    "sdvt-fill-b3b3b3", // the unknown team takes the column's naColor (#b3b3b3), as the HTML table
    `sdvt-fill-${buf?.slice(1)}`,
  ]);
  expect(got.map((r) => cls(r, "t2"))).toEqual([
    `sdvt-bar-6-${kc?.slice(1)}`,
    "sdvt-bar-6-b3b3b3",
    `sdvt-bar-6-${buf?.slice(1)}`,
  ]);
  expect(props.sx[`& .MuiDataGrid-cell.sdvt-bar-6-${kc?.slice(1)}`]).toEqual({
    borderLeft: `6px solid ${kc}`,
  });
  expect(props.sx[`& .sdvt-fill-${buf?.slice(1)}`]).toMatchObject({ backgroundColor: buf });
  expect(got.map((r) => r.cell.get("w")?.className.match(/sdvt-/) ?? null)).toEqual([null, null, null]);
  expect(warnings.filter((w) => /XXX/.test(w))).toHaveLength(1); // sdvplot warns once per unknown value
});

test("headshots: a player leaderboard draws each player's ESPN headshot in its own row; an id with no headshot keeps the id", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.headshot("qb_espn_id", { league: "nfl", label: "", height: 40 }),
      c.text("qb"),
      c.num("net_epa", { digits: 3 }),
    ])
    .theme("booktabs")
    .rowKey("qb_espn_id")
    .build();
  await prepare(spec);
  const got = cells(grid(spec, STANDINGS));
  expect(got.map((r) => r.id)).toEqual(STANDINGS.map((s) => s.qb_espn_id));
  for (const [i, s] of STANDINGS.entries()) {
    const img = got[i]?.cell.get("qb_espn_id")?.querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${s.qb_espn_id}.png`,
    );
    expect(img?.getAttribute("data-sdv-id")).toBe(s.qb_espn_id);
    expect(img?.getAttribute("height")).toBe("40");
    expect(got[i]?.cell.get("qb")?.textContent).toBe(s.qb);
  }
  // gsis ids resolve through the gsis map prepare() loads; an unknown one keeps its text and warns once
  const gs = defineTable<{ p: string }>()
    .columns((c) => [c.headshot("p", { league: "nfl", idSystem: "gsis" })])
    .theme("booktabs")
    .build();
  await prepare(gs);
  cleanup();
  const g = cells(grid(gs, [{ p: "00-0033873" }, { p: "00-9999999" }, { p: "00-9999999" }]));
  expect(g[0]?.cell.get("p")?.querySelector("img")?.getAttribute("src")).toMatch(/^https:\/\//);
  expect(g[1]?.cell.get("p")?.querySelector("img")).toBeNull();
  expect(g[1]?.cell.get("p")?.textContent).toBe("00-9999999");
  expect(warnings.filter((w) => /00-9999999/.test(w))).toHaveLength(1);
});

test("missing assets: a team with colours but no logo, or an unknown team, keeps its text; one warning each", async () => {
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
  const got = cells(grid(spec, rows));
  const shown = got.map((r) => {
    const c = r.cell.get("team");
    return c?.querySelector("img") ? "img" : c?.textContent;
  });
  expect(shown).toEqual(["DEL", "img", "DEL", "ZZZ", "ZZZ"]);
  expect(warnings.filter((w) => /logo/.test(w))).toHaveLength(1); // Delaware: no logo archived
  expect(warnings.filter((w) => /ZZZ/.test(w))).toHaveLength(1);
  expect(warnings).toHaveLength(2);
});

test("theme mapping: sdv, midnight and booktabs tokens become the grid's CSS variables, header styles and density", () => {
  for (const [name, density, want] of [
    ["sdv", "comfortable", "standard"],
    ["midnight", "compact", "compact"],
    ["booktabs", "social", "comfortable"],
  ] as const) {
    const spec = defineTable<Standing>()
      .columns((c) => [c.text("team")])
      .theme(name, { density })
      .build();
    const t = resolveTheme(spec.theme).tokens;
    const p = dataGridProps(spec, STANDINGS);
    expect(p.density, name).toBe(want);
    expect(p.sx["&&"], name).toEqual({
      "--DataGrid-t-color-foreground-base": t.text,
      "--DataGrid-t-color-foreground-muted": t.muted,
      "--DataGrid-t-color-border-base": t.rule,
      "--DataGrid-t-typography-font-family-base": t.fontBody,
      "--DataGrid-t-typography-font-body": `${t.bodyWeight} ${t.bodySize} ${t.fontBody}`,
      "--DataGrid-t-color-background-base": t.bg,
      "--DataGrid-t-cell-background-pinned": t.bg,
      "--DataGrid-t-header-background-base": t.labelBg,
    });
    expect(p.sx["& .MuiDataGrid-columnHeaderTitle"], name).toMatchObject({
      fontFamily: t.fontLabel,
      fontWeight: t.labelWeight,
      fontSize: t.labelSize,
    });
    expect(p.sx["& .MuiDataGrid-columnHeader"], name).toEqual({ color: t.labelColor });
  }
  // midnight is dark: its text reads on its background, and team rows are laid over that background
  const mid = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .theme("midnight")
    .build();
  const p = dataGridProps(mid, STANDINGS, { teamRows: { key: "team", league: "nfl" } });
  const vars = p.sx["&&"] as Record<string, string>;
  expect(
    contrast(
      vars["--DataGrid-t-color-foreground-base"] ?? "",
      vars["--DataGrid-t-color-background-base"] ?? "",
    ),
  ).toBeGreaterThan(7);
  const dark = teamColorPalette("nfl", ["KC"], { background: "#0C0D10" })[0];
  const kc = p.getRowClassName({ row: STANDINGS[0] as Standing, indexRelativeToCurrentPage: 0 });
  const rule = p.sx[`& .${kc}`] as { backgroundColor: string; color: string };
  // 0.4 of KC's dark-mode colour over midnight's #0C0D10, with text that reads on it
  expect(rule.backgroundColor).toBe(solid(`${dark}66`, "#0C0D10"));
  expect(contrast(rule.color, rule.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  // the sx reaches the grid: MUI's root carries an emotion class whose doubled selector holds midnight's variables
  const container = grid(mid, STANDINGS, p);
  const css = Array.from(document.querySelectorAll("style"))
    .map((s) => s.textContent)
    .join("\n");
  const own = Array.from(container.querySelector(".MuiDataGrid-root")?.classList ?? []).filter((c) =>
    c.startsWith("css-"),
  );
  expect(
    own.some(
      (c) => css.includes(`.${c}.${c}{`) && css.includes("--DataGrid-t-color-background-base:#0C0D10"),
    ),
  ).toBe(true);
});

test("stripes on odd rows of a striped theme (savant), unless a team colour fills the row", () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .theme("savant")
    .build();
  const p = dataGridProps(spec, STANDINGS);
  expect(STANDINGS.map((row, i) => p.getRowClassName({ row, indexRelativeToCurrentPage: i }))).toEqual(
    STANDINGS.map((_, i) => (i % 2 === 1 ? "sdvt-stripe" : "")),
  );
  expect(p.sx["& .MuiDataGrid-row.sdvt-stripe"]).toEqual({ backgroundColor: expect.stringMatching(/^#/) });
  const t = dataGridProps(spec, STANDINGS, { teamRows: { key: "team", league: "nfl" } });
  expect(STANDINGS.map((row, i) => t.getRowClassName({ row, indexRelativeToCurrentPage: i }))).toEqual(
    STANDINGS.map(() => expect.stringMatching(/^sdvt-fill-[0-9a-f]{6}$/)),
  );
});

test("columns: labels, alignment, px widths, numeric types, and plain values (one warning) for kinds not mapped", () => {
  const spec = defineTable<Standing>()
    .columns((c) => [
      c.text("team", { width: "120px", sortable: false }),
      c.int("wins", { label: "W", width: "10%" }),
      c.pct("net_epa", { digits: 1, scale: true, subheader: "per play" }),
      c.colorPills("pf"),
      c.colorPills("pa"),
    ])
    .theme("sdv")
    .build();
  const p = dataGridProps(spec, STANDINGS);
  const picked = p.columns.map((c) => [
    c.field,
    c.headerName,
    c.align,
    c.type,
    c.width,
    c.sortable,
    c.description,
  ]);
  expect(picked).toEqual([
    ["team", "Team", "left", undefined, 120, false, undefined],
    ["wins", "W", "right", "number", undefined, undefined, undefined],
    ["net_epa", "Net Epa", "right", "number", undefined, undefined, "per play"],
    ["pf", "Pf", "right", "number", undefined, undefined, undefined],
    ["pa", "Pa", "right", "number", undefined, undefined, undefined],
  ]);
  const fmt = p.columns[2]?.valueFormatter as unknown as (v: unknown) => string;
  expect([fmt(0.063), fmt(-0.146), fmt(null)]).toEqual(["6.3%", "−14.6%", ""]);
  expect(warnings.filter((w) => /width/.test(w))).toHaveLength(1);
  expect(warnings.filter((w) => /colorPills/.test(w))).toHaveLength(1); // two pills columns, one warning
});

test("row ids and heights: the index without a rowKey (a foreign row throws), and rows tall enough for the images", () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.headshot("qb_espn_id", { league: "nfl", height: 60 })])
    .theme("sdv", { density: "compact" })
    .build();
  const p = dataGridProps(spec, STANDINGS);
  expect(STANDINGS.map((r) => p.getRowId(r))).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);
  expect(() => p.getRowId({ ...(STANDINGS[0] as Standing) })).toThrow(/rowKey/);
  // MUI draws floor(rowHeight * 0.7) px rows under compact: room for the 60 px headshot and 4 px each side
  expect(Math.floor(p.rowHeight * 0.7)).toBeGreaterThanOrEqual(68);
  const plain = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .theme("sdv")
    .build();
  expect(dataGridProps(plain, STANDINGS).rowHeight).toBe(52);
});

// ---- review fixes

test("row ids: first-wins by row object; a repeated row, a repeated rowKey value or a blank rowKey value throws", () => {
  const plain = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .theme("sdv")
    .build();
  const [a, b] = STANDINGS as [Standing, Standing];
  // the same object twice: MUI would see one id twice and drop a row
  expect(() => dataGridProps(plain, [a, b, a])).toThrow(/rows 0 and 2/);
  const keyed = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .theme("sdv")
    .rowKey("team")
    .build();
  expect(() => dataGridProps(keyed, [a, b, { ...a }])).toThrow(/rows 0 and 2 .*"KC"/);
  for (const blank of [null, undefined, "", "  "]) {
    const rows = [a, { ...b, team: blank as unknown as string }];
    expect(() => dataGridProps(keyed, rows), String(blank)).toThrow(InputError);
    expect(() => dataGridProps(keyed, rows), String(blank)).toThrow(/row 1 .*rowKey "team"/);
  }
  expect(STANDINGS.map((r) => dataGridProps(keyed, STANDINGS).getRowId(r))).toEqual(
    STANDINGS.map((s) => s.team),
  );
});

test("numbers: a blank or unparseable value is missing (empty, and last in both sort directions, as sdvtables' engine)", () => {
  type R = { id: string; n: number | null };
  const rows = [
    { id: "a", n: 3 },
    { id: "b", n: "" as unknown as number },
    { id: "c", n: 1 },
    { id: "d", n: null },
    { id: "e", n: "x" as unknown as number },
    { id: "f", n: 2 },
  ] satisfies R[];
  const spec = defineTable<R>()
    .columns((c) => [c.text("id"), c.int("n")])
    .theme("sdv")
    .rowKey("id")
    .build();
  const props = dataGridProps(spec, rows);
  const order = (sort: "asc" | "desc") => {
    cleanup();
    const got = cells(
      grid(spec, rows, props, { initialState: { sorting: { sortModel: [{ field: "n", sort }] } } }),
    );
    return got.map((r) => `${r.id}:${r.cell.get("n")?.textContent}`);
  };
  expect(order("asc")).toEqual(["c:1", "f:2", "a:3", "b:", "d:", "e:"]);
  expect(order("desc")).toEqual(["a:3", "f:2", "c:1", "b:", "d:", "e:"]);
});

test("formats match the HTML table: scaleNote's divisor, decimals and label suffix, and superscript ranks", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team"), c.int("pf"), c.num("pa"), c.rank("srs_rank")])
    .scaleNote(["pf", "pa"], { divisor: 1000, decimals: 2, where: "both" })
    .theme("sdv")
    .rowKey("team")
    .build();
  await prepare(spec);
  const html = renderHTML(spec, STANDINGS, { css: "none" });
  const doc = new DOMParser().parseFromString(html, "text/html");
  const htmlCell = (row: number, key: string) =>
    doc.querySelector(`tr[data-row="${row}"] td[data-col="${key}"]`) as Element;
  const htmlLabel = (key: string) => doc.querySelector(`th[data-col="${key}"]`)?.textContent?.trim() ?? "";
  const props = dataGridProps(spec, STANDINGS);
  expect(props.columns.map((c) => c.headerName)).toEqual(["team", "pf", "pa", "srs_rank"].map(htmlLabel));
  const got = cells(grid(spec, STANDINGS, props));
  for (const [i, s] of STANDINGS.entries()) {
    for (const k of ["pf", "pa", "srs_rank"])
      expect(got[i]?.cell.get(k)?.textContent, `${s.team} ${k}`).toBe(htmlCell(i, k).textContent);
    // the rank's suffix is a superscript, as in the HTML table
    expect(got[i]?.cell.get("srs_rank")?.querySelector("sup")?.textContent).toBe(
      htmlCell(i, "srs_rank").querySelector("sup")?.textContent,
    );
  }
  expect(got[0]?.cell.get("pf")?.textContent).toBe("0.39"); // 385 / 1000, 2 decimals
  expect(warnings).toEqual([]);
});

test("team fills keep their colour on hover and when selected: a shifted shade with text that still reads", () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.text("team")])
    .theme("midnight")
    .rowKey("team")
    .build();
  const p = dataGridProps(spec, STANDINGS, { teamRows: { key: "team", league: "nfl" } });
  for (const row of STANDINGS) {
    const cls = p.getRowClassName({ row, indexRelativeToCurrentPage: 0 });
    const base = p.sx[`& .${cls}`] as { backgroundColor: string };
    for (const state of [":hover", ".Mui-selected", ".Mui-selected:hover"]) {
      const key = Object.keys(p.sx).find((k) => k.split(", ").includes(`& .MuiDataGrid-row.${cls}${state}`));
      expect(key, `${row.team} ${state}`).toBeDefined();
      const rule = p.sx[key as string] as { backgroundColor: string; color: string };
      expect(rule.backgroundColor).not.toBe(base.backgroundColor);
      expect(contrast(rule.color, rule.backgroundColor), `${row.team} ${state}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("a headshot is decorative (empty alt): the player's name is in the row", async () => {
  const spec = defineTable<Standing>()
    .columns((c) => [c.headshot("qb_espn_id", { league: "nfl" }), c.text("qb")])
    .theme("sdv")
    .rowKey("team")
    .build();
  await prepare(spec);
  const imgs = cells(grid(spec, STANDINGS)).map((r) => r.cell.get("qb_espn_id")?.querySelector("img"));
  expect(imgs.map((i) => i?.getAttribute("alt"))).toEqual(STANDINGS.map(() => ""));
});
