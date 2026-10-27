// @vitest-environment node
import perspective from "@perspective-dev/client";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { colorPalette } from "../src/_web.js";
import { getLeagueSync } from "../src/index-data.js";
import { loadLeague, logoUrlSync, resetWarnings, setWarningHandler } from "../src/index.js";
import { type PerspectiveRow, perspectiveConfig, perspectiveLogoColumn } from "../src/perspective.js";
import "./_fixtures.js";

function warnings<T>(fn: () => T): [T, string[]] {
  const spy = vi.fn();
  resetWarnings();
  setWarningHandler(spy);
  try {
    return [fn(), spy.mock.calls.map((c) => String(c[0]))];
  } finally {
    setWarningHandler(null);
  }
}
const colors = (css: string | undefined): string[] =>
  /^linear-gradient\(to right, (#[0-9a-f]{6}(?:, #[0-9a-f]{6})*)\)$/.exec(css ?? "")?.[1]?.split(", ") ?? [];

// The 2024 NFL regular season's four best offences by EPA per play (nflverse play-by-play,
// fixtures/examples/nfl_epa_2024_reg.csv: off_plays and off_epa / off_plays), with their ESPN team ids
const EPA = [
  { team: "BAL", espn: 33, plays: 1091, epa_per_play: 0.1973 },
  { team: "BUF", espn: 2, plays: 1065, epa_per_play: 0.1869 },
  { team: "DET", espn: 8, plays: 1125, epa_per_play: 0.1552 },
  { team: "WAS", espn: 28, plays: 1142, epa_per_play: 0.1394 },
];
const byTeam = (col: "team" | "espn", plugin?: string): string[] =>
  colors(
    perspectiveConfig(
      EPA.map((r) => ({ t: r[col], v: r.epa_per_play })),
      { teamCol: "t", league: "nfl", plugin: plugin ?? "Y Bar" },
    ).columns_config.v?.palette,
  );

afterEach(() => setWarningHandler(null));

describe("numeric and string team ids", () => {
  test("ESPN ids as numbers: no Datagrid fill and one warning; as strings Perspective reads them as numbers too", () => {
    for (const ids of [EPA.map((r) => r.espn), EPA.map((r) => String(r.espn))]) {
      const rows = ids.map((t, i) => ({ team_id: t, wins: [12, 15, 12, 13][i] }));
      const [grid, w] = warnings(() => perspectiveConfig(rows, { teamCol: "team_id", league: "nfl" }));
      expect(grid.columns_config).toEqual({
        wins: { number_format: { useGrouping: false, maximumFractionDigits: 0 } },
      });
      expect(w).toEqual([
        "no team colors on the Datagrid: the team column 'team_id' is numeric, and team colors need a string or categorical team column (Perspective fills only text cells)",
      ]);
    }
    // a text column of the same teams is filled
    const [grid, w] = warnings(() => perspectiveConfig(EPA, { teamCol: "team", league: "nfl" }));
    expect(w).toEqual([]);
    expect(grid.columns_config.team?.bg_mode).toBe("series");
    expect(colors(grid.columns_config.team?.bg_color)).toHaveLength(4);
  });

  test("a chart splits numeric ids in numeric order, the palette of those teams in that order", () => {
    // sorted as numbers (2 BUF, 8 DET, 28 WAS, 33 BAL), not as text ("2" < "28" < "33" < "8"); the shared palette
    // over those four teams in numeric order, through another adapter's path (all four resolve, none repeats)
    const ids = byTeam("espn");
    expect(ids).toEqual(colorPalette("nfl", ["BUF", "DET", "WAS", "BAL"], { background: "#ffffff" }));
    // the same ids loaded as text split in text order: a real check of the numeric sort
    const rows = EPA.map((r) => ({ t: r.espn, v: r.epa_per_play }));
    const text = perspectiveConfig(rows, {
      teamCol: "t",
      league: "nfl",
      plugin: "Y Bar",
      schema: { t: "string", v: "float" },
    });
    expect(colors(text.columns_config.v?.palette)).toEqual(
      colorPalette("nfl", ["BUF", "WAS", "BAL", "DET"], { background: "#ffffff" }),
    );
    expect(colors(text.columns_config.v?.palette)).not.toEqual(ids);
    // ids as strings are numbers to Perspective, so they split as numbers too
    const strings = EPA.map((r) => ({ t: String(r.espn), v: 1.5 }));
    const bars = perspectiveConfig(strings, { teamCol: "t", league: "nfl", plugin: "Y Bar" });
    expect(colors(bars.columns_config.v?.palette)).toEqual(ids);
  });

  test("numbers and strings mixed in one team column are an InputError", () => {
    expect(() =>
      perspectiveConfig([{ t: "KC" }, { t: 2 }, { t: "BUF" }], {
        teamCol: "t",
        league: "nfl",
        plugin: "Y Bar",
      }),
    ).toThrow(/the team column 't' mixes number and string values/);
  });
});

describe("the logo column", () => {
  afterAll(() => setWarningHandler(null));

  test("sits right after the team column and holds each team's logo URL; the rows given are unchanged", () => {
    const rows = EPA.map(({ team, plays }) => ({ team, plays }));
    const out = perspectiveLogoColumn(rows, "team", { league: "nfl" });
    expect(out.map((r) => Object.keys(r))).toEqual(rows.map(() => ["team", "team_logo", "plays"]));
    expect(out.map((r) => r.team_logo)).toEqual(EPA.map((r) => logoUrlSync(r.team, "nfl") ?? null));
    expect(out.every((r) => typeof r.team_logo === "string")).toBe(true);
    expect(rows.every((r) => !("team_logo" in r))).toBe(true);
    expect(
      perspectiveLogoColumn(rows, "team", { league: "nfl", name: "logo", variant: "dark" })[0]?.logo,
    ).toBe(logoUrlSync("BAL", "nfl", { variant: "dark" }));
  });

  test("a missing asset is null, with one warning per reason: no team, and no archived logo", async () => {
    await loadLeague("ncaa_whockey");
    // Delaware is in the NCAA women's hockey index with colours but no archived logo
    const del = getLeagueSync("ncaa_whockey").teams.find((t) => t.abbr === "DEL");
    expect(del).toBeDefined();
    const other = getLeagueSync("ncaa_whockey").teams.find((t) => t.abbr === "MINN")?.abbr as string;
    const rows: PerspectiveRow[] = [
      { t: other },
      { t: "DEL" },
      { t: "ZZZ" },
      { t: "DEL" },
      { t: null },
      { t: "ZZZ" },
    ];
    const [out, w] = warnings(() => perspectiveLogoColumn(rows, "t", { league: "ncaa_whockey" }));
    expect(out.map((r) => r.t_logo)).toEqual([
      logoUrlSync(other, "ncaa_whockey"),
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(typeof out[0]?.t_logo).toBe("string");
    expect(w).toHaveLength(2);
    expect(w.find((m) => /did not resolve/.test(m))).toMatch(/'ZZZ'/);
    expect(w.find((m) => /no logo archived/.test(m))).toMatch(/: DEL$/);
    // strict throws for the unresolved team
    expect(() => perspectiveLogoColumn(rows, "t", { league: "ncaa_whockey", strict: true })).toThrow(/ZZZ/);
  });

  test("each distinct team is resolved once, and the config shows the column as links on the Datagrid only", () => {
    const rows = [{ t: "LV" }, { t: "LV" }, { t: "LA" }, { t: "LV" }];
    const out = perspectiveLogoColumn(rows, "t", { league: "nfl" });
    expect(new Set(out.map((r) => r.t_logo)).size).toBe(2);
    expect(
      perspectiveConfig(out, { teamCol: "t", league: "nfl", logoCol: "t_logo" }).columns_config.t_logo,
    ).toEqual({
      link: true,
    });
    const chart = perspectiveConfig(out, { teamCol: "t", league: "nfl", logoCol: "t_logo", plugin: "Y Bar" });
    expect(chart.columns_config.t_logo).toBeUndefined();
  });

  test("bad names raise", () => {
    expect(() => perspectiveLogoColumn(EPA, "team", { league: "nfl", name: "plays" })).toThrow(
      /already have a column 'plays'/,
    );
    expect(() => perspectiveLogoColumn(EPA, "club", { league: "nfl" })).toThrow(/no column 'club'/);
    expect(() => perspectiveConfig(EPA, { teamCol: "team", league: "nfl", logoCol: "logo" })).toThrow(
      /no column 'logo'/,
    );
  });
});

describe("number formats", () => {
  test("3 decimals for a float, 1 for a percentage, integers plain; formats override or drop one", () => {
    const rows = EPA.map((r, i) => ({ ...r, comp_pct: [66.21, 64.04, 70.33, 63.5][i] }));
    for (const plugin of ["Datagrid", "Y Bar"]) {
      const cc = perspectiveConfig(rows, { teamCol: "team", league: "nfl", plugin }).columns_config;
      expect(cc.epa_per_play?.number_format).toEqual({ minimumFractionDigits: 3, maximumFractionDigits: 3 });
      expect(cc.comp_pct?.number_format).toEqual({ minimumFractionDigits: 1, maximumFractionDigits: 1 });
      expect(cc.plays?.number_format).toEqual({ useGrouping: false, maximumFractionDigits: 0 });
      expect(cc.espn?.number_format).toEqual({ useGrouping: false, maximumFractionDigits: 0 });
    }
    const two = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    const cc = perspectiveConfig(rows, {
      teamCol: "team",
      league: "nfl",
      formats: { epa_per_play: two, plays: null },
    }).columns_config;
    expect(cc.epa_per_play?.number_format).toEqual(two);
    expect(cc.plays).toBeUndefined();
    expect(() => perspectiveConfig(rows, { teamCol: "team", league: "nfl", formats: { epa: two } })).toThrow(
      /no column 'epa'/,
    );
  });

  test("a column's type is Perspective 5.5.1's own: the rows' inference matches `table.schema()`", async () => {
    // each column a case of how Perspective types JSON rows (numbers, numeric strings, text, nulls, booleans, dates)
    const rows: PerspectiveRow[] = [
      { i: 1, f: 2.5, wf: 1.0, si: "12", sf: "1.5", se: "1e3", txt: "KC", n: null, b: true, d: "2024-09-05", big: 3e9, mix: 1, sm: "12" },
      { i: 2, f: 1, wf: 2.0, si: " 7", sf: "2", se: "-3", txt: "BUF", n: null, b: false, d: "2024-09-08", big: 1, mix: 2.5, sm: "x" },
    ]; // biome-ignore format: one column per case
    const table = await perspective.table(rows.map((r) => ({ ...r })));
    const schema = (await table.schema()) as Record<string, "integer" | "float" | "string">;
    await table.delete();
    const fmt = (s?: Record<string, "integer" | "float" | "string">) =>
      perspectiveConfig(rows, { teamCol: "txt", league: "nfl", ...(s ? { schema: s } : {}) }).columns_config;
    expect(fmt()).toEqual(fmt(schema));
    // and it is not vacuous: integers, floats and non-numbers all occur
    expect(new Set(Object.values(schema))).toEqual(
      new Set(["integer", "float", "string", "boolean", "date"]),
    );
  });
});

describe("colours", () => {
  test("a null team takes no Datagrid or Color slot, and the first split slot, the fallback grey", () => {
    const rows = EPA.map((r) => ({ team: r.team === "DET" ? null : r.team, v: r.epa_per_play }));
    const grid = perspectiveConfig(rows, { teamCol: "team", league: "nfl" }).columns_config;
    expect(colors(grid.team?.bg_color)).toHaveLength(3);
    const bars = perspectiveConfig(rows, { teamCol: "team", league: "nfl", plugin: "Y Bar" }).columns_config;
    const plain = perspectiveConfig(
      rows.filter((r) => r.team !== null),
      { teamCol: "team", league: "nfl", plugin: "Y Bar" },
    ).columns_config;
    expect(colors(bars.v?.palette)).toEqual(["#808080", ...colors(plain.v?.palette)]);
    expect(colors(bars.team?.palette)).toEqual(colors(plain.team?.palette));
  });

  test("dark mode is Pro Dark and every team reads on #242526; no rows, no palette", () => {
    const dark = perspectiveConfig(EPA, { teamCol: "team", league: "nfl", plugin: "Y Line", mode: "dark" });
    expect(dark.theme).toBe("Pro Dark");
    expect(colors(dark.columns_config.plays?.palette)).not.toEqual(byTeam("team", "Y Line"));
    const none = perspectiveConfig([], {
      teamCol: "t",
      league: "nfl",
      plugin: "Y Bar",
      schema: { t: "string", v: "float" },
    });
    expect(none.columns_config).toEqual({
      v: { number_format: { minimumFractionDigits: 3, maximumFractionDigits: 3 } },
    });
    expect(() => perspectiveConfig(EPA, { teamCol: "team", league: "nfl", mode: "dim" as "dark" })).toThrow(
      /mode/,
    );
    expect(() => perspectiveConfig(EPA, { teamCol: "team", league: "nfl", season: 1850 })).toThrow(
      /season 1850/,
    );
  });
});

describe("a registry theme", () => {
  // datagolf's light spec, the fields perspectiveConfig reads (sdvtables' tableThemeSpec("datagolf"); the parity test and
  // packages/sdvtables/test/table-theme-spec.test.ts check the whole registry path against Python)
  const DATAGOLF = {
    fonts: { body: "Fira Sans", numeric: "Fira Sans" },
    sizes: { body: 12 },
    palette: { neg: "#a62a23", pos: "#2b6b4e" },
  };
  const SIGN = "linear-gradient(to right, #a62a23 0%, #2b6b4e 100%)";

  test("the Datagrid takes the body face and size, and the sign colours on every number column, not the team's", () => {
    const plain = perspectiveConfig(EPA, { teamCol: "team", league: "nfl" });
    const themed = perspectiveConfig(EPA, { teamCol: "team", league: "nfl", theme: DATAGOLF });
    expect(Object.keys(themed)).toEqual(["plugin", "theme", "plugin_config", "columns_config"]);
    expect(themed.plugin_config).toEqual({ font_family: "Fira Sans", font_size: 12 });
    expect(themed.columns_config.team).toEqual(plain.columns_config.team);
    for (const c of ["espn", "plays", "epa_per_play"]) {
      expect(themed.columns_config[c]).toEqual({ ...plain.columns_config[c], fg_color: SIGN });
      // the numeric face is the body face: no font of its own on the column
      expect(themed.columns_config[c]).not.toHaveProperty("font_family");
    }
  });

  test("a numeric face of its own goes on the number columns; no body face, no plugin_config", () => {
    const mono = { ...DATAGOLF, fonts: { body: "Roboto", numeric: "Roboto Mono" } };
    const cfg = perspectiveConfig(EPA, { teamCol: "team", league: "nfl", theme: mono });
    expect(cfg.columns_config.plays).toMatchObject({ fg_color: SIGN, font_family: "Roboto Mono" });
    expect(cfg.columns_config.team).not.toHaveProperty("font_family");
    const faceless = perspectiveConfig(EPA, {
      teamCol: "team",
      league: "nfl",
      theme: { ...DATAGOLF, fonts: { numeric: "Roboto Mono" } },
    });
    expect(faceless).not.toHaveProperty("plugin_config");
    expect(faceless.columns_config.plays).toMatchObject({ fg_color: SIGN, font_family: "Roboto Mono" });
  });

  test("a function of the mode is called once with the call's mode, on every plugin", () => {
    for (const plugin of ["Datagrid", "Y Bar"])
      for (const mode of ["light", "dark"] as const) {
        const seen: string[] = [];
        const theme = (m: "light" | "dark") => {
          seen.push(m);
          return DATAGOLF;
        };
        const cfg = perspectiveConfig(EPA, { teamCol: "team", league: "nfl", plugin, mode, theme });
        expect(seen).toEqual([mode]);
        expect(cfg).toEqual(
          perspectiveConfig(EPA, { teamCol: "team", league: "nfl", plugin, mode, theme: DATAGOLF }),
        );
      }
  });

  test("a theme name, null or a spec-less object is an InputError, on every plugin", () => {
    for (const plugin of ["Datagrid", "Y Bar"])
      for (const bad of [
        "datagolf",
        null,
        { fonts: {} },
        () => "datagolf",
        () => undefined, // a function must return a spec: undefined is not "no theme"
        { ...DATAGOLF, sizes: {} },
        { ...DATAGOLF, palette: { neg: "#a62a23" } },
        { ...DATAGOLF, fonts: { body: 12 } },
      ])
        expect(() =>
          perspectiveConfig(EPA, { teamCol: "team", league: "nfl", plugin, theme: bad as never }),
        ).toThrow(/theme must be a table theme spec or a function of the mode.*tableThemeSpec/);
  });

  test("a chart takes none of it", () => {
    for (const plugin of ["Y Bar", "X/Y Scatter"])
      expect(perspectiveConfig(EPA, { teamCol: "team", league: "nfl", plugin, theme: DATAGOLF })).toEqual(
        perspectiveConfig(EPA, { teamCol: "team", league: "nfl", plugin }),
      );
  });
});
