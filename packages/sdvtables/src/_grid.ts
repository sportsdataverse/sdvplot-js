/**
 * What the data grid adapters (`./mui` for MUI X Data Grid, `./aggrid` for AG Grid) share: reading cells, team ids and
 * colours, row ids and their checks, number formats (with a scaleNote and the rank suffix), the missing-last sort and the
 * image lookups with their warnings. Internal, not a subpath. It imports neither grid: each adapter turns these values
 * into its own grid's shapes (MUI's `sx` classes and React cells, AG Grid's inline styles and DOM cell renderers).
 */
import {
  type IdSystem,
  InputError,
  type League,
  type SeasonInput,
  type Which,
  checkAlpha,
  headshotUrl,
  hex6,
  logoUrlSync,
  onColor,
  resolveSync,
  solid,
  warn,
} from "@sportsdataverse/sdvplot";
import { type Comparator, type SortDir, comparatorFor, withMissingLast } from "./engine.js";
import { TableSpecError } from "./errors.js";
import { formatNumber, isBlank, ordinal, scaledNumber, toNumber } from "./format.js";
import { scaleNoteOf } from "./html/decorations.js";
import type { ColumnSpec, TableSpec } from "./spec.js";
import type { ThemeTokens } from "./themes/tokens.js";

/** Which adapter is speaking, for its warnings and errors. */
export interface GridName {
  /** The adapter's function, which starts each message: "dataGridProps". */
  readonly fn: string;
  /** The warning key's namespace: "mui". */
  readonly ns: string;
  /** The grid, in messages: "MUI X Data Grid". */
  readonly grid: string;
  /** The grid, in "<short>'s default is kept": "MUI". */
  readonly short: string;
  /** What the adapter builds, in messages: "props". */
  readonly built: string;
}
/** sdvplot's team palette for a background (each adapter passes its own subpath's `teamColorPalette`). */
export type PaletteFn = (
  league: League,
  teams: readonly unknown[],
  o: { idSystem?: IdSystem; background?: string; which?: Which },
) => string[];
/** A colour laid over the background, opaque, and its readable text colour. */
export interface Fill {
  readonly fill: string;
  readonly ink: string;
}

/** A cell's text: trimmed, "" for a blank value. Team and image lookups key on it, so 12 and "12" are one team. */
export const cell = (v: unknown): string => (isBlank(v) ? "" : String(v).trim());
export const value = (row: unknown, key: string): unknown =>
  row == null ? undefined : (row as Record<string, unknown>)[key];
/** The theme's background as an opaque hex (white for a transparent theme). */
export const opaque = (t: ThemeTokens): string => (t.bg === "transparent" ? "#ffffff" : hex6(t.bg));
const alphaHex = (a: number): string =>
  Math.round(checkAlpha(a) * 255)
    .toString(16)
    .padStart(2, "0");
/** `color` over `bg` at `alpha`, opaque, with its readable text colour. */
export const tint = (color: string, alpha: number, bg: string): Fill => {
  const fill = solid(`${hex6(color, { dropAlpha: true })}${alphaHex(alpha)}`, bg);
  return { fill, ink: onColor(fill) };
};

/** Each distinct cell value of `key` (trimmed text) -> its team id, by ONE resolveSync over the rows (one warning). */
export function teamIds(
  rows: readonly unknown[],
  key: string,
  league: League,
  o: { season?: SeasonInput | undefined; idSystem?: IdSystem | undefined; strict?: boolean | undefined },
): Map<string, string> {
  const raw = [...new Set(rows.map((r) => cell(value(r, key))).filter((v) => v !== ""))];
  const ids = resolveSync(raw, league, {
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
    strict: o.strict ?? false,
  });
  const out = new Map<string, string>();
  raw.forEach((v, i) => {
    const id = ids[i];
    if (id !== undefined) out.set(v, id);
  });
  return out;
}
/** Each team id -> its palette colour for `bg` (sdvplot's `teamColorPalette`, not a fork of it). */
export function palette(
  teamColorPalette: PaletteFn,
  league: League,
  ids: readonly string[],
  which: Which | undefined,
  bg: string,
): Map<string, string> {
  const colors = teamColorPalette(league, ids, {
    idSystem: "team_id",
    background: bg,
    ...(which === undefined ? {} : { which }),
  });
  return new Map(ids.map((id, i) => [id, colors[i] ?? "#808080"]));
}
/** A `teamColorBg` / `teamColorBar` column: each cell value's colour, its team's palette colour else `naColor`. */
export function teamColorOf<Row>(
  col: ColumnSpec<Row> & { kind: "teamColorBg" | "teamColorBar" },
  rows: readonly Row[],
  bg: string,
  teamColorPalette: PaletteFn,
): (raw: unknown) => string {
  const ids = teamIds(rows, col.key, col.league, col);
  const colors = palette(teamColorPalette, col.league, [...new Set(ids.values())], col.which, bg);
  return (raw) => {
    const id = ids.get(cell(raw));
    return (id === undefined ? undefined : colors.get(id)) ?? col.naColor;
  };
}
/** `teamRows`: each team value (trimmed text) -> its fill and ink; a team that is not found has none. */
export function teamRowFills(
  rows: readonly unknown[],
  tr: {
    key: string;
    league: League;
    which?: Which | undefined;
    alpha?: number | undefined;
    season?: SeasonInput | undefined;
    idSystem?: IdSystem | undefined;
  },
  bg: string,
  teamColorPalette: PaletteFn,
): Map<string, Fill> {
  const alpha = tr.alpha ?? 0.4;
  const ids = teamIds(rows, tr.key, tr.league, tr);
  const colors = palette(teamColorPalette, tr.league, [...new Set(ids.values())], tr.which, bg);
  const out = new Map<string, Fill>();
  for (const [v, id] of ids) {
    const color = colors.get(id);
    if (color !== undefined) out.set(v, tint(color, alpha, bg));
  }
  return out;
}

export function checkHeight(h: number, kind: string): number {
  if (!(Number.isFinite(h) && h >= 1))
    throw new TableSpecError(`${kind} height must be a number of pixels >= 1, got ${String(h)}`);
  return h;
}
/** A logo or wordmark column: each cell value (trimmed text) -> its team id and image URL; no URL, no entry. */
export function logoMarks<Row>(
  col: ColumnSpec<Row> & { kind: "logo" | "wordmark" },
  rows: readonly Row[],
): Map<string, { id: string; url: string }> {
  const marks = new Map<string, { id: string; url: string }>();
  for (const [v, id] of teamIds(rows, col.key, col.league, col)) {
    const url = logoUrlSync(id, col.league, {
      ...(col.season === undefined ? {} : { season: col.season }),
      ...(col.variant === undefined ? {} : { variant: col.variant }),
      markType: col.kind,
      idSystem: "team_id",
    }); // undefined: no mark archived, and sdvplot warned once
    if (url !== undefined) marks.set(v, { id, url });
  }
  return marks;
}
/** A headshot column: each player id (trimmed text) -> its headshot URL; a player with none warns once. */
export function headshotUrls<Row>(
  col: ColumnSpec<Row> & { kind: "headshot" },
  rows: readonly Row[],
  who: GridName,
): Map<string, string> {
  const urls = new Map<string, string>();
  for (const v of new Set(rows.map((r) => cell(value(r, col.key))))) {
    if (v === "") continue;
    const url = headshotUrl(v, col.league, { idSystem: col.idSystem });
    if (url === undefined)
      warn(
        `sdvtables:${who.ns}:headshot:${col.league}:${v}`,
        `${who.fn}: no ${col.league} headshot for player ${JSON.stringify(v)}: the cell keeps the id`,
      );
    else urls.set(v, url);
  }
  return urls;
}

/** scaleNote, as the HTML table applies it: num/int cells divided (with its decimals), the label suffixed; last wins. */
export function scaleNotes<Row>(spec: TableSpec<Row>): {
  scaled: Map<string, { divisor: number; decimals: number }>;
  labelSuffix: Map<string, string>;
} {
  const scaled = new Map<string, { divisor: number; decimals: number }>();
  const labelSuffix = new Map<string, string>();
  for (const d of spec.decorations) {
    if (d.type !== "scaleNote") continue;
    const { suffix } = scaleNoteOf(d);
    for (const k of d.columns as readonly string[]) {
      scaled.set(k, { divisor: d.divisor, decimals: d.decimals });
      if (d.where !== "sourceNote") labelSuffix.set(k, ` ${suffix}`);
    }
  }
  return { scaled, labelSuffix };
}
const numberFormat =
  (f: (n: number) => string) =>
  (v: unknown): string => {
    const n = toNumber(v);
    return n === null ? "" : f(n);
  };
/** A number column's cell text, as the HTML table writes it ("" for a blank value); undefined for other kinds. */
export function formatterFor<Row>(
  col: ColumnSpec<Row>,
  scaled: ReadonlyMap<string, { divisor: number; decimals: number }>,
): ((v: unknown) => string) | undefined {
  switch (col.kind) {
    case "num": {
      const sc = scaled.get(col.key);
      if (sc) return numberFormat((n) => scaledNumber(n, sc));
      return numberFormat((n) =>
        formatNumber(n, {
          ...(col.digits === undefined ? {} : { digits: col.digits }),
          big: col.big ?? false,
          prefix: col.prefix ?? "",
          suffix: col.suffix ?? "",
          forceSign: col.forceSign ?? false,
        }),
      );
    }
    case "int": {
      const sc = scaled.get(col.key);
      return numberFormat((n) => (sc ? scaledNumber(n, sc) : formatNumber(n, { digits: 0, big: true })));
    }
    case "pct":
      return numberFormat((n) => `${formatNumber(col.scale ? n * 100 : n, { digits: col.digits })}%`);
    case "rank":
      return numberFormat(ordinal);
    default:
      return undefined;
  }
}
/** A rank's number and its suffix, for the HTML table's superscript (`1<sup>st</sup>`); null for a blank value. */
export function rankParts(v: unknown): { num: string; suffix: string } | null {
  const n = toNumber(v);
  if (n === null) return null;
  const num = String(Math.trunc(n));
  return { num, suffix: ordinal(n).slice(num.length) };
}
/** sdvtables' own sort for a column (its `compare`, else by kind), missing values last in the given direction. */
export function missingLast<Row>(col: ColumnSpec<Row>, rows: readonly Row[]): (dir: SortDir) => Comparator {
  const compare = comparatorFor(col, rows);
  return (dir) => withMissingLast(compare, dir);
}
/** A column's px `width` as a number; any other CSS width is left to the grid, with one warning. */
export function pxWidth<Row>(col: ColumnSpec<Row>, who: GridName): number | undefined {
  if (col.width === undefined) return undefined;
  const m = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(col.width);
  if (m) return Number(m[1]);
  warn(
    `sdvtables:${who.ns}:width:${col.key}`,
    `${who.fn}: column "${col.key}" width ${JSON.stringify(col.width)} is not in px; ${who.grid} widths are px numbers, so ${who.short}'s default is kept`,
  );
  return undefined;
}
/** A kind the grid draws as its plain value: one warning per kind. */
export function unmapped(kind: string, who: GridName): void {
  warn(
    `sdvtables:${who.ns}:kind:${kind}`,
    `${who.fn}: ${who.grid} cells for "${kind}" columns are not mapped yet; they show the plain value`,
  );
}

/**
 * Every row's id, checked once: `String(row[rowKey])`, else the row's index in `rows`. First wins for a row object; a
 * repeated id (the same object with no rowKey, or two rows with one rowKey value) or a blank rowKey value throws, since
 * the grid would drop a row. The returned function also ids a row the grid was not built from, by its rowKey.
 */
export function rowIds<Row>(
  rows: readonly Row[],
  key: (keyof Row & string) | undefined,
  who: GridName,
): (row: Row) => string {
  const keyOf = (row: Row, i: number | string): string => {
    const v = value(row, key as string);
    if (isBlank(v))
      throw new InputError(
        `${who.fn}: row ${i} has no value for rowKey "${String(key)}" (${String(v)}); ${who.grid} needs an id for every row`,
      );
    return String(v);
  };
  const index = new Map<Row, string>();
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    const id = key === undefined ? String(index.has(r) ? index.get(r) : i) : keyOf(r, i);
    const j = seen.get(id);
    if (j !== undefined)
      throw new InputError(
        key === undefined
          ? `${who.fn}: rows ${j} and ${i} are the same object, so ${who.grid} would give them one id and drop one; copy the row or set the spec's rowKey`
          : `${who.fn}: rows ${j} and ${i} have the same rowKey "${String(key)}" value "${id}"; ${who.grid} needs a unique id per row`,
      );
    seen.set(id, i);
    if (!index.has(r)) index.set(r, id);
  });
  return (row) => {
    const known = index.get(row);
    if (known !== undefined) return known;
    if (key !== undefined) return keyOf(row, "(not in rows)");
    throw new TableSpecError(
      `${who.fn}: a row the ${who.built} were not built from has no id; set the spec's rowKey, or build the ${who.built} from the rows you pass the grid`,
    );
  };
}
