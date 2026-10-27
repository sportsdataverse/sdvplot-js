/**
 * Perspective 5.5 (`@perspective-dev/viewer`, with the `-datagrid` and `-charts` plugins): team colours, number formats
 * and a logo column for a `<perspective-viewer>`, the JavaScript side of sdvplot's Python `sdvplot.perspective`. Both
 * functions return plain data: a viewer config (the argument of `viewer.restore()`) and rows with a logo URL column.
 * Given the same rows and options, `perspectiveConfig` returns what Python's `perspective_sdv_config` returns
 * (fixtures/perspective/oracle.json holds the Python answers; packages/sdvplot/test/perspective-parity.test.ts compares).
 * Pure: Perspective is never imported, not even its types. Call after `loadLeague(league)` / `preloadAll()`.
 */
import { colorPalette } from "./_web.js";
import { hex6 } from "./contrast.js";
import { InputError, warn } from "./errors.js";
import { normSeason } from "./normalize.js";
import { placeSync } from "./placement.js";
import type { Value } from "./resolve.js";
import type { IdSystem, League, SeasonInput, Variant } from "./types.js";

/** A row: column name to value, as `perspective.table(rows)` takes them. */
export type PerspectiveRow = Readonly<Record<string, unknown>>;
/** A Perspective column type, as `await table.schema()` gives it. */
export type PerspectiveType = "integer" | "float" | "string" | "boolean" | "date" | "datetime";
/** A Perspective schema: column name to type, as `await table.schema()` gives it. */
export type PerspectiveSchema = Readonly<Record<string, PerspectiveType>>;
/** A `number_format`: Intl.NumberFormat options, e.g. `{ maximumFractionDigits: 2 }`. */
export type PerspectiveNumberFormat = { readonly [option: string]: string | number | boolean };
/** One column's entry in `columns_config`: the keys sdvplot sets. */
export type PerspectiveColumnConfig = {
  /** The Datagrid's cell fill: "series", one palette colour per distinct value. */
  bg_mode?: "series";
  /** The Datagrid's series palette: `linear-gradient(to right, #rrggbb, …)`. */
  bg_color?: string;
  /** A chart's series palette (on a value column) or a scatter's Color slot palette (on the team column). */
  palette?: string;
  number_format?: PerspectiveNumberFormat;
  /** The Datagrid shows a URL column as links. */
  link?: true;
};
/** What `perspectiveConfig` returns: pass it to `viewer.restore()`, with your own view keys merged in. */
export type PerspectiveConfig = {
  plugin: string;
  /** Perspective's own theme: "Pro Light" or "Pro Dark" (load `@perspective-dev/viewer/dist/css/pro.css` / `pro-dark.css`). */
  theme: "Pro Light" | "Pro Dark";
  columns_config: Record<string, PerspectiveColumnConfig>;
};

/** `perspectiveConfig` options. */
export interface PerspectiveConfigOptions {
  /** The column holding the team identifiers (any id system `resolve` reads). */
  teamCol: string;
  /** The SDV league key, e.g. "nfl". */
  league: League;
  /** The plugin: "Datagrid" (the default) or a chart's name ("Y Bar", "X Bar", "Y Line", "X/Y Scatter", …). */
  plugin?: string;
  /** "light" (default) or "dark": the Perspective theme, "Pro Light" or "Pro Dark". */
  mode?: "light" | "dark";
  /** A logo URL column (`perspectiveLogoColumn`) to show as links on the Datagrid, which draws no images. */
  logoCol?: string;
  /** The colour the teams must read against. Default: the Perspective theme's (#ffffff Pro Light, #242526 Pro Dark). */
  background?: string;
  /** Per column, a `number_format` to use instead of the default, or null for none. */
  formats?: Readonly<Record<string, PerspectiveNumberFormat | null>>;
  /** One season for every team. */
  season?: SeasonInput;
  /** How the team values are read. Default "auto". */
  idSystem?: IdSystem;
  /** Throw UnresolvedTeamError for a team that does not resolve, instead of one warning and #808080. */
  strict?: boolean;
  /**
   * The column types, as `await table.schema()` gives them. Default: worked out from the rows as Perspective does
   * (numbers, and strings that read as numbers, are "integer" or "float"; anything else is not a number). Pass it when
   * you load the table with a schema of your own.
   */
  schema?: PerspectiveSchema;
}

// Perspective's two built-in themes and their --psp--background-color (5.5.1's pro.css and pro-dark.css)
const PRO = { light: ["Pro Light", "#ffffff"], dark: ["Pro Dark", "#242526"] } as const;
const FALLBACK = "#808080";
// A float column whose name says it is a percentage (fg_pct, pct_complete, win_percent) shows 1 decimal; any other
// float (a rate, EPA) shows 3; an integer is shown as typed (1039 and 2024, not 1,039 or 2,024)
const PERCENT = /(^|_)(pct|percent|perc)(_|$)/i;

function numberFormat(name: string, type: PerspectiveType): PerspectiveNumberFormat {
  if (type === "integer") return { useGrouping: false, maximumFractionDigits: 0 };
  const n = PERCENT.test(name) ? 1 : 3;
  return { minimumFractionDigits: n, maximumFractionDigits: n };
}

const INT = /^\s*-?\d+\s*$/;
const FLOAT = /^\s*-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/;
/** A value's Perspective number type, or "other" (null for a missing value). */
function kindOf(v: unknown): "integer" | "float" | "other" | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return "integer";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "other";
    return Number.isInteger(v) && Math.abs(v) < 2 ** 31 ? "integer" : "float";
  }
  if (typeof v === "string") return INT.test(v) ? "integer" : FLOAT.test(v) ? "float" : "other";
  return "other";
}

/**
 * The rows' schema, as `perspective.table(rows)` works it out for the number columns (checked against Perspective
 * 5.5.1 in test/perspective.test.ts). ponytail: a non-number column is "string" here, whatever Perspective makes of it
 * (a boolean, a date): sdvplot only asks whether a column is a number.
 */
function inferSchema(rows: readonly PerspectiveRow[]): Record<string, PerspectiveType> {
  const kinds = new Map<string, Set<string>>();
  for (const r of rows)
    for (const [k, v] of Object.entries(r)) {
      const s = kinds.get(k) ?? kinds.set(k, new Set()).get(k)!;
      const kind = kindOf(v);
      if (kind !== null) s.add(kind);
    }
  return Object.fromEntries(
    [...kinds].map(([k, s]) => [
      k,
      s.size === 0 || s.has("other") ? "string" : s.has("float") ? "float" : "integer",
    ]),
  );
}

const isNumber = (t: PerspectiveType | undefined): boolean => t === "integer" || t === "float";
const quote = (s: string): string => `'${s}'`;

function checkColumns(schema: PerspectiveSchema, cols: readonly (string | undefined)[]): void {
  const names = Object.keys(schema);
  for (const c of cols)
    if (c !== undefined && !Object.hasOwn(schema, c))
      throw new InputError(`the rows have no column ${quote(c)} (columns: ${names.join(", ")})`);
}

/**
 * The distinct non-null team values in the order a grid or a scatter's Color slot meets them (first appearance), and in
 * a chart's split order: sorted, numerically for a number column, else by code unit as Perspective sorts strings
 * (upper case first). InputError for numbers and strings mixed.
 */
function teamOrders(values: readonly unknown[], numeric: boolean, col: string): [unknown[], unknown[]] {
  const first = [...new Set(values.filter((v) => v !== null && v !== undefined))];
  const types = new Set(first.map((v) => (typeof v === "bigint" ? "number" : typeof v)));
  if (types.size > 1)
    throw new InputError(
      `the team column ${quote(col)} mixes ${[...types].sort().join(" and ")} values: use one id system`,
    );
  const key = numeric ? (v: unknown) => Number(v) : (v: unknown) => String(v);
  const sorted = [...first].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return [first, sorted];
}

const gradient = (colors: readonly string[]): string => `linear-gradient(to right, ${colors.join(", ")})`;

/**
 * A Perspective viewer config that colours each team by its own colours, for the Datagrid or a chart: the argument of
 * `viewer.restore()`, as Python's `perspective_sdv_config` builds it (same keys, same colours, same order).
 *
 * The colours are the shared team palette (every adapter's, and Python's), taken over the teams in sorted order: each
 * team's colour, made 3:1 against the background and ΔE 20 from every earlier team's, so a team keeps one colour
 * whatever the rows' order. Perspective takes a palette, not a colour per value, so each palette lists those colours in
 * the order Perspective hands colours out (checked in Chromium on Perspective 5.5.1):
 *
 * - `plugin: "Datagrid"`: the team column's cells are filled (`bg_mode` "series"), in the order the grid first draws
 *   each value: the rows' order. Keep the grid in the rows' order (no `sort`) and to about one row per team. Null
 *   cells take no colour and no slot. Only a text team column is filled: Perspective fills no number column, so
 *   numeric team ids get none, with one warning.
 * - a chart: split a bar, line or area chart by the team (`split_by: [teamCol]`) and each series takes its colour
 *   from every number column's `palette`, in sorted order (Perspective sorts split values; a null series comes first,
 *   so the palette then starts with the fallback grey). Put the team column in an "X/Y Scatter"'s Color slot (its
 *   third column) and each team's points take theirs from the team column's `palette`, in the rows' order.
 *
 * Every number column also gets a `number_format` (Intl.NumberFormat options): 3 decimals for a float, 1 for a float
 * named as a percentage (`pct`, `percent`), and an integer plain (2024, not 2,024). `formats` overrides them.
 *
 * @param rows - the rows the viewer shows (what `perspective.table(rows)` loads). With no rows and no `schema` no column is
 *   known: the config has `plugin` and `theme` and an empty `columns_config`, without an error (pass the table's
 *   `schema` for its number formats, as Python's empty frame keeps its columns).
 * @returns `plugin`, `theme` and `columns_config`; merge your own `group_by`, `split_by`, `columns` and the rest in.
 * @throws InputError for a column the rows do not have (`teamCol`, `logoCol` or a `formats` key), a team column that
 *   mixes numbers and strings, an unknown `mode`, or a season outside the league's. UnresolvedTeamError with
 *   `strict: true`.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { perspectiveConfig } from "@sportsdataverse/sdvplot/perspective";
 *
 * await loadLeague("nfl");
 * // 2024 regular season, offence: EPA per play (nflverse play-by-play)
 * const epa = [
 *   { posteam: "BAL", epa_per_play: 0.218 },
 *   { posteam: "BUF", epa_per_play: 0.1885 },
 *   { posteam: "DET", epa_per_play: 0.1592 },
 * ];
 * const grid = perspectiveConfig(epa, { teamCol: "posteam", league: "nfl" });
 * const bars = {
 *   ...perspectiveConfig(epa, { teamCol: "posteam", league: "nfl", plugin: "Y Bar" }),
 *   group_by: ["posteam"],
 *   split_by: ["posteam"],
 *   columns: ["epa_per_play"],
 * };
 * // in the browser: await viewer.load(await worker.table(epa)); await viewer.restore(grid)
 * [grid.columns_config.posteam?.bg_color, bars.columns_config.epa_per_play?.palette];
 * ```
 */
export function perspectiveConfig(
  rows: readonly PerspectiveRow[],
  o: PerspectiveConfigOptions,
): PerspectiveConfig {
  const mode = o.mode ?? "light";
  if (mode !== "light" && mode !== "dark")
    throw new InputError(`mode must be 'light' or 'dark', not ${quote(String(mode))}`);
  const schema = o.schema ?? inferSchema(rows);
  const { teamCol, logoCol } = o;
  // no rows and no schema: no column is known, so none is missing (Python's empty frame still has its columns)
  if (o.schema !== undefined || rows.length > 0)
    checkColumns(schema, [teamCol, logoCol, ...Object.keys(o.formats ?? {})]);
  const [pro, proBg] = PRO[mode];
  const bg = o.background === undefined ? proBg : hex6(o.background);
  const season = normSeason(o.season, o.league);
  const text = !isNumber(schema[teamCol]); // Perspective fills a string column's cells, never a number column's
  const numeric = Object.keys(schema).filter((c) => c !== teamCol && isNumber(schema[c]));
  const grid = (o.plugin ?? "Datagrid") === "Datagrid";
  const values = rows.map((r) => r[teamCol]);
  const [first, ascending] = teamOrders(values, !text, teamCol);
  // the shared team palette every adapter uses (Python's perspective._palette): unresolved values grey, out of it
  const pal = colorPalette(o.league, ascending, {
    ...(season === null ? {} : { season }),
    background: bg,
    idSystem: o.idSystem ?? "auto",
    strict: o.strict ?? false,
    fallback: FALLBACK,
  });
  const color = new Map(ascending.map((v, i) => [v, pal[i] as string]));
  // a null split series comes first: palette entry 0
  const nulls = values.some((v) => v === null || v === undefined) ? [FALLBACK] : [];
  const byAppearance = gradient(first.map((v) => color.get(v) as string));
  const byValue = gradient([...nulls, ...pal]);
  let columns: Record<string, PerspectiveColumnConfig> = {};
  for (const c of numeric) {
    const fmt =
      o.formats !== undefined && Object.hasOwn(o.formats, c) ? o.formats[c] : numberFormat(c, schema[c]!);
    columns[c] = fmt === null || fmt === undefined ? {} : { number_format: fmt };
  }
  // no teams (no rows) means no palette at all: an empty palette is not a valid CSS value
  if (first.length > 0 && !grid) {
    for (const c of numeric) columns[c]!.palette = byValue;
    if (text) columns = { [teamCol]: { palette: byAppearance }, ...columns }; // a number Color slot is a gradient
  } else if (first.length > 0 && text) {
    columns = { [teamCol]: { bg_mode: "series", bg_color: byAppearance }, ...columns };
  } else if (first.length > 0) {
    warn(
      `perspective:numeric-team:${teamCol}`,
      `no team colors on the Datagrid: the team column ${quote(teamCol)} is numeric, and team colors need a string or categorical team column (Perspective fills only text cells)`,
    );
  }
  if (grid && logoCol !== undefined) columns[logoCol] = { link: true };
  return {
    plugin: o.plugin ?? "Datagrid",
    theme: pro,
    columns_config: Object.fromEntries(Object.entries(columns).filter(([, v]) => Object.keys(v).length > 0)),
  };
}

/** `perspectiveLogoColumn` options. */
export interface PerspectiveLogoOptions {
  /** The SDV league key, e.g. "nfl". */
  league: League;
  /** The new column's name. Default: `${teamCol}_logo`. It must not be a column already. */
  name?: string;
  /** One season for every team: the logo of that season (relocations and rebrands). */
  season?: SeasonInput;
  /** "default", "dark", or a named variant from `marks()`. */
  variant?: Variant;
  /** How the team values are read. Default "auto". */
  idSystem?: IdSystem;
  /** Throw UnresolvedTeamError for a team that does not resolve, instead of warning. */
  strict?: boolean;
}

/**
 * The rows with a column of each team's logo URL, right after the team column, as Python's `perspective_logo_column`
 * adds it. Each distinct team is resolved once. A team that does not resolve, or has no archived logo, gets a null URL,
 * with one warning for each reason. Show the column as links with `perspectiveConfig(rows, { logoCol })`: Perspective
 * 5.5's Datagrid draws no images. The rows given are not changed.
 *
 * @returns new rows, each with the URL (a string, or null) in `name`.
 * @throws InputError for a `teamCol` no row has, a `name` a row already has, or a season outside the league's.
 *   UnresolvedTeamError with `strict: true`.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { perspectiveConfig, perspectiveLogoColumn } from "@sportsdataverse/sdvplot/perspective";
 *
 * await loadLeague("nfl");
 * const epa = [
 *   { posteam: "BAL", epa_per_play: 0.218 },
 *   { posteam: "BUF", epa_per_play: 0.1885 },
 * ];
 * const rows = perspectiveLogoColumn(epa, "posteam", { league: "nfl" });
 * const config = perspectiveConfig(rows, { teamCol: "posteam", league: "nfl", logoCol: "posteam_logo" });
 * [Object.keys(rows[0] ?? {}), config.columns_config.posteam_logo];
 * ```
 */
export function perspectiveLogoColumn<R extends PerspectiveRow>(
  rows: readonly R[],
  teamCol: string,
  o: PerspectiveLogoOptions,
): (R & Record<string, string | null>)[] {
  const name = o.name ?? `${teamCol}_logo`;
  if (rows.length > 0 && !rows.some((r) => Object.hasOwn(r, teamCol)))
    throw new InputError(`the rows have no column ${quote(teamCol)}`);
  if (rows.some((r) => Object.hasOwn(r, name)))
    throw new InputError(`the rows already have a column ${quote(name)}: pass another name`);
  const values = [...new Set(rows.map((r) => r[teamCol]).filter((v) => v !== null && v !== undefined))];
  const at = values.map((_, i) => i);
  const placed = placeSync(
    at,
    at.map(() => 0),
    values as Value[],
    {
      league: o.league,
      season: normSeason(o.season, o.league),
      kind: "logo",
      variant: o.variant ?? "default",
      idSystem: o.idSystem ?? "auto",
      strict: o.strict ?? false,
    },
  );
  const urls = new Map<unknown, string>(placed.map((p) => [values[p.index], p.url]));
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    const url = urls.get(r[teamCol]) ?? null;
    for (const [k, v] of Object.entries(r)) {
      out[k] = v;
      if (k === teamCol) out[name] = url;
    }
    if (!Object.hasOwn(out, name)) out[name] = url;
    return out as R & Record<string, string | null>;
  });
}
