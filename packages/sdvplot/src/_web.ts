/** What the spec adapters (Plotly, Vega-Lite, ECharts) share: image sources, aspect ratios, row access, team colours. */
import { teamColorsSync } from "./colors.js";
import { InputError } from "./errors.js";
import { HEADSHOT_ASPECT } from "./headshots.js";
import { type Kind, type PlaceOptions, type Placement, placeSync as place } from "./placement.js";
import type { Value } from "./resolve.js";
import type { IdSystem, League, MarkType, SeasonInput, Variant } from "./types.js";

export type { Placement } from "./placement.js";
export { checkAlpha, checkHeight, placeSync as place } from "./placement.js";

/** What the module-level test hooks return. Positional on purpose (cheap to assert); the contract shim in test/adapters.contract.test.ts converts. */
export type DrawnMark = readonly [id: string, x: unknown, y: unknown, height: number, url: string];
export type DrawnAxisMark = readonly [id: string, index: number, height: number];

export type Row = Record<string, unknown>;
export interface MarkOptions {
  x: string;
  y: string;
  team: string;
  league: League;
  season?: SeasonInput | string;
  height?: number;
  alpha?: number;
  variant?: Variant;
  idSystem?: IdSystem;
  embed?: ReadonlyMap<string, string>;
}
export interface HeadshotOptions {
  x: string;
  y: string;
  player: string;
  league: League;
  height?: number;
  alpha?: number;
  idSystem?: "espn" | "gsis";
  embed?: ReadonlyMap<string, string>;
}
export interface AxisOptions {
  league: League;
  season?: SeasonInput;
  height?: number;
  variant?: Variant;
  markType?: MarkType;
  idSystem?: IdSystem;
  embed?: ReadonlyMap<string, string>;
}

export function aspect(p: Placement): number {
  return p.aspect ?? HEADSHOT_ASPECT;
}

export function axisLetter(axis: string): "x" | "y" {
  if (axis !== "x" && axis !== "y")
    throw new InputError(`axis must be "x" or "y", got ${JSON.stringify(axis)}`);
  return axis;
}

// encodeURI keeps the URL punctuation Python's SAFE_URL keeps (-._~:/?#[]@!$&()*+,;=%) and escapes the rest, so an
// unvalidated URL still cannot close an attribute the adapter writes it into. `%` is re-escaped only when it does not
// already start a %XX escape.
export function imageSource(p: Placement, embed?: ReadonlyMap<string, string>): string {
  return embed?.get(p.url) ?? encodeURI(p.url).replace(/%25([0-9A-Fa-f]{2})/g, "%$1");
}
export function imageSources(ps: readonly Placement[], embed?: ReadonlyMap<string, string>): string[] {
  return ps.map((p) => imageSource(p, embed));
}

/** Data URIs for each distinct url, fetched once each. The one async helper of the adapters: call it, then pass the map as `embed`. */
export async function embedSources(
  urls: Iterable<string>,
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const url of new Set(urls)) {
    const res = await fetchFn(url);
    if (!res.ok) throw new InputError(`embed: ${url} answered ${res.status}`);
    const mime =
      res.headers.get("content-type")?.split(";")[0] ??
      (url.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "application/octet-stream");
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    out.set(url, `data:${mime};base64,${btoa(bin)}`);
  }
  return out;
}

// Cells are typed Value for placeSync; a Date (temporal x) or any other cell passes through it untouched.
export function column(rows: readonly Row[], name: string, what: string): Value[] {
  if (rows.length > 0 && !rows.some((r) => name in r))
    throw new InputError(`${what} column ${JSON.stringify(name)} is not in rows`);
  return rows.map((r) => r[name] as Value);
}

export function seasons(
  rows: readonly Row[],
  season: MarkOptions["season"],
): readonly SeasonInput[] | SeasonInput {
  if (typeof season === "string" && rows.some((r) => season in r))
    return rows.map((r) => r[season] as SeasonInput);
  return season as SeasonInput;
}

/** placeSync over row columns (x, y, team or player, season value or column), leaving out options the caller left out. */
export function markPlacements(
  rows: readonly Row[],
  kind: Kind,
  o: MarkOptions | HeadshotOptions,
): Placement[] {
  const xs = column(rows, o.x, "x");
  const ys = column(rows, o.y, "y");
  if (kind === "headshot") {
    const h = o as HeadshotOptions;
    return place(xs, ys, column(rows, h.player, "player"), {
      league: h.league,
      kind,
      idSystem: h.idSystem ?? "espn",
    });
  }
  const m = o as MarkOptions;
  const po: PlaceOptions = { league: m.league, kind, season: seasons(rows, m.season) };
  if (m.variant !== undefined) po.variant = m.variant;
  if (m.idSystem !== undefined) po.idSystem = m.idSystem;
  return place(xs, ys, column(rows, m.team, "team"), po);
}
/** placeSync over a category axis: label i sits at index i along `letter` and 0 across, so `p.x`/`p.y` is its tick index. */
export function axisPlacements(labels: readonly string[], letter: "x" | "y", o: AxisOptions): Placement[] {
  const index = labels.map((_, i) => i);
  const across = labels.map(() => 0);
  const po: PlaceOptions = { league: o.league, kind: o.markType ?? "logo", season: o.season };
  if (o.variant !== undefined) po.variant = o.variant;
  if (o.idSystem !== undefined) po.idSystem = o.idSystem;
  return place(letter === "x" ? index : across, letter === "x" ? across : index, labels, po);
}

export function colorList(
  league: League,
  teams: readonly unknown[],
  o: { which?: "primary" | "secondary"; season?: SeasonInput; idSystem?: IdSystem } = {},
): (string | null)[] {
  return teams.map((t) => teamColorsSync(league, t as never, o) ?? null);
}
