/**
 * The MapLibre GL JS 6 adapter: team logos as a native `symbol` layer (`logoSymbols`, with `addLogoImages` to load
 * each logo once into the map's images), team-coloured travel lines as a `line` layer (`routeLines`), and a free,
 * keyless basemap (`basemap`, OpenFreeMap). Each builder returns plain style JSON: a GeoJSON source and a layer that
 * reads it, for `map.addSource(set.id, set.source)` and `map.addLayer(set.layer)`. Pure: `maplibre-gl` (an optional
 * peer, 6.14 or later) is never imported at runtime, only its types; the map is passed in. For deck.gl layers on a
 * MapLibre map, hand `@sportsdataverse/sdvplot/deckgl`'s `logoIconLayer` / `passArcLayer` props to deck.gl's layers
 * inside `@deck.gl/mapbox`'s `MapboxOverlay`. Synchronous builders: call after `loadLeague(league)` / `preloadAll()`.
 */
import type {
  GeoJSONSourceSpecification,
  LineLayerSpecification,
  Map as MapLibreMap,
  SymbolLayerSpecification,
} from "maplibre-gl";
import { type DrawnMark, type Row, checkAlpha, colorPalette, column, markPlacements } from "./_web.js";
import { contentId } from "./content-id.js";
import { InputError, warn } from "./errors.js";
import { normValue } from "./normalize.js";
import { type Value, resolveSync } from "./resolve.js";
import type { IdSystem, League, SeasonInput, Variant, Which } from "./types.js";

export type { DrawnMark, Row } from "./_web.js";

/** `logoSymbols` options. */
export interface LogoSymbolOptions {
  /** Name of the row column holding each logo's longitude. */
  x: string;
  /** Name of the row column holding each logo's latitude. */
  y: string;
  /** Name of the row column holding the team (abbreviation, name or id, a number or a string; see `idSystem`). */
  team: string;
  /** The league the teams belong to, e.g. "nfl". */
  league: League;
  /** A season (number or string) for every row, or the name of a row column holding each row's season. */
  season?: SeasonInput;
  /** Logo variant, e.g. "dark". Default "default". */
  variant?: Variant;
  /** How the `team` values are read. Default "auto". */
  idSystem?: IdSystem;
  /** The logo's height on screen in px, 1 or more. Default 32. */
  size?: number;
  /** The logos' opacity in [0, 1] (`icon-opacity`). Default 1. */
  alpha?: number;
  /** The source and layer id. Default "sdvplot-logos". */
  id?: string;
}
/** A logo feature's properties. */
export interface LogoProperties {
  /** The resolved team id. */
  team: string;
  /** The map image the symbol draws (`icon-image`), one per logo and size. */
  icon: string;
  /** The logo's URL. */
  url: string;
  /** The row's position in the input (left-out rows leave gaps). */
  index: number;
}
/** One logo the map needs as an image: `addLogoImages` loads `url` and adds it as `id`, drawn `height` px tall. */
export interface LogoImage {
  id: string;
  url: string;
  height: number;
}
/** A GeoJSON point: [longitude, latitude]. */
export interface PointGeometry {
  type: "Point";
  coordinates: [lon: number, lat: number];
}
/** A GeoJSON line through [longitude, latitude] positions. */
export interface LineGeometry {
  type: "LineString";
  coordinates: [lon: number, lat: number][];
}
/** A GeoJSON feature; its id is the row's index in the input. */
export interface Feature<G, P> {
  type: "Feature";
  id: number;
  geometry: G;
  properties: P;
}
/** A GeoJSON source holding a feature collection: `map.addSource(id, source)`. */
export type FeatureSource<G, P> = GeoJSONSourceSpecification & {
  type: "geojson";
  data: { type: "FeatureCollection"; features: Feature<G, P>[] };
};
/** `logoSymbols`' result: a source and a symbol layer for the map, and the images that layer draws. */
export interface LogoSymbols {
  /** The source id (the layer's own id too). */
  id: string;
  /** One point feature per drawn row; the feature id is the row's index. */
  source: FeatureSource<PointGeometry, LogoProperties>;
  layer: SymbolLayerSpecification;
  /** One per distinct logo: what `addLogoImages` loads. */
  images: LogoImage[];
}

/** `routeLines` options. */
export interface RouteLineOptions {
  /** Name of the row column holding each leg's start longitude. */
  x: string;
  /** Name of the row column holding each leg's start latitude. */
  y: string;
  /** Name of the row column holding each leg's end longitude. */
  xend: string;
  /** Name of the row column holding each leg's end latitude. */
  yend: string;
  /** Name of the row column holding the team the leg is coloured by. */
  team: string;
  /** The league the teams belong to, e.g. "nfl". */
  league: League;
  /** The season the teams are resolved for. */
  season?: SeasonInput;
  /** How the `team` values are read. Default "auto". */
  idSystem?: IdSystem;
  /** "primary" (default) or "secondary" colour. */
  which?: Which;
  /**
   * The basemap's background (`basemap("dark").background` under the dark basemap). Given, every team colour keeps 3:1
   * contrast against it and aims to stay distinct from the other teams' (CIE76 ΔE of 20 or more), through the shared
   * team palette, as `teamColorPalette` does in the other adapters.
   */
  background?: string;
  /** The colour of a team that does not resolve, or has no colour. Default "#808080". */
  fallback?: string;
  /** The line's width in px, 1 or more. Default 3. */
  width?: number;
  /** The lines' opacity in [0, 1] (`line-opacity`). Default 1. */
  alpha?: number;
  /** The source and layer id. Default "sdvplot-routes". */
  id?: string;
}
/** A route feature's properties. */
export interface RouteProperties {
  /** The resolved team id, or the row's own value as text when it does not resolve. */
  team: string;
  /** The line's colour, `#rrggbb`. */
  color: string;
  /** The row's position in the input (left-out rows leave gaps). */
  index: number;
}
/** `routeLines`' result: a source and a line layer for the map. */
export interface RouteLines {
  id: string;
  /** One two-point line per drawn row; the feature id is the row's index. */
  source: FeatureSource<LineGeometry, RouteProperties>;
  layer: LineLayerSpecification;
}

/** The map methods `addLogoImages` calls: a MapLibre `Map`. */
export type LogoImageMap = Pick<MapLibreMap, "loadImage" | "addImage" | "hasImage">;

const real = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
function checkPx(name: string, v: unknown): number {
  if (!real(v) || v < 1) throw new InputError(`${name} is in px, 1 or more, got ${String(v)}`);
  return v;
}

/**
 * Each row's team logo at its (longitude, latitude), as a GeoJSON source and a MapLibre `symbol` layer: one point
 * feature per row (its `id` is the row's index; `team`, `icon`, `url` and `index` are its properties), and a layer
 * drawing `icon-image: ["get", "icon"]`, every logo shown even where two overlap. A team with no logo (or one that
 * does not resolve) is left out with one warning; so is a row with a missing coordinate. Team values may be numbers
 * or strings (ESPN ids, abbreviations, names). The map needs the logos as images first:
 * `await addLogoImages(map, logos)`, then `map.addSource(logos.id, logos.source)` and `map.addLayer(logos.layer)`.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoSymbols } from "@sportsdataverse/sdvplot/maplibre";
 *
 * await loadLeague("nfl");
 * // Kansas City's home airport, from nflverse's nfldata airports.csv
 * const logos = logoSymbols([{ team: "KC", lon: -94.714, lat: 39.297 }], {
 *   x: "lon",
 *   y: "lat",
 *   team: "team",
 *   league: "nfl",
 *   size: 40,
 * });
 * // in the browser: await addLogoImages(map, logos); map.addSource(logos.id, logos.source); map.addLayer(logos.layer)
 * logos.source.data.features[0]?.properties.icon;
 * ```
 */
export function logoSymbols(rows: readonly Row[], o: LogoSymbolOptions): LogoSymbols {
  const size = checkPx("size", o.size ?? 32);
  const opacity = checkAlpha(o.alpha ?? 1);
  const id = o.id ?? "sdvplot-logos";
  const images = new Map<string, LogoImage>();
  const features = markPlacements(rows, "logo", o).map((p): Feature<PointGeometry, LogoProperties> => {
    const icon = `${contentId("sdv-logo", p.url)}-${size}`;
    if (!images.has(icon)) images.set(icon, { id: icon, url: p.url, height: size });
    return {
      type: "Feature",
      id: p.index,
      geometry: { type: "Point", coordinates: [Number(p.x), Number(p.y)] },
      properties: { team: p.id, icon, url: p.url, index: p.index },
    };
  });
  return {
    id,
    source: { type: "geojson", data: { type: "FeatureCollection", features } },
    layer: {
      id,
      type: "symbol",
      source: id,
      layout: {
        "icon-image": ["get", "icon"],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity": opacity },
    },
    images: [...images.values()],
  };
}

/**
 * Loads each logo of `logoSymbols` sets into the map's images, once: `map.loadImage(url)`, then
 * `map.addImage(id, image, { pixelRatio })`, the pixel ratio making the image draw `size` px tall at icon size 1 (and
 * stay sharp on a high-density screen). An image the map already has is skipped, so calling it again (another layer,
 * or after a style change re-adds the layers) adds nothing twice. A logo that fails to load is left undrawn with one
 * warning. Resolves when every image is in. Call it before adding the layers that draw them.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { addLogoImages, logoSymbols } from "@sportsdataverse/sdvplot/maplibre";
 *
 * await loadLeague("nfl");
 * const logos = logoSymbols([{ team: "KC", lon: -94.714, lat: 39.297 }], { x: "lon", y: "lat", team: "team", league: "nfl" });
 * // a stand-in for a MapLibre map (in the browser: the map from `new maplibregl.Map(...)`, once it has loaded)
 * const added: string[] = [];
 * const map = {
 *   hasImage: (id: string) => added.includes(id),
 *   loadImage: async () => ({ data: { width: 500, height: 500 } as ImageBitmap }),
 *   addImage(id: string) {
 *     added.push(id);
 *     return this;
 *   },
 * };
 * await addLogoImages(map as never, logos);
 * added;
 * ```
 */
export async function addLogoImages(map: LogoImageMap, ...sets: readonly LogoSymbols[]): Promise<void> {
  const want = new Map(sets.flatMap((s) => s.images).map((im) => [im.id, im]));
  await Promise.all(
    [...want.values()].map(async (im) => {
      if (map.hasImage(im.id)) return;
      let image: HTMLImageElement | ImageBitmap;
      try {
        image = (await map.loadImage(im.url)).data;
      } catch (e) {
        warn(`maplibre:image:${im.url}`, `could not load the logo ${im.url}: ${String(e)}`);
        return;
      }
      if (map.hasImage(im.id)) return; // another call added it while this one loaded
      map.addImage(im.id, image, { pixelRatio: image.height / im.height });
    }),
  );
}

/** An unresolved team value as text: a number without ".0", a missing one empty (as `./deckgl`'s arcs). */
const label = (t: unknown): string =>
  t === null || t === undefined ? "" : typeof t === "number" ? (normValue(t) ?? "") : String(t);

/**
 * Team-coloured travel legs as a GeoJSON source and a MapLibre `line` layer: one straight line per row from (x, y) to
 * (xend, yend) in longitude and latitude, in the team's colour (`line-color: ["get", "color"]`). Each team keeps one
 * colour, from the shared team palette; with `background` the colours read on the basemap (dark mode) and stay
 * distinct. A team that does not resolve takes `fallback`; a row with a missing coordinate is left out with one
 * warning. The feature id is the row's index. The same rows feed `./deckgl`'s `passArcLayer` for arcs instead.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { routeLines } from "@sportsdataverse/sdvplot/maplibre";
 *
 * await loadLeague("nfl");
 * // Kansas City to Buffalo, airport to airport (nflverse nfldata airports.csv): week 11 of 2024
 * const leg = { team: "KC", lon: -94.714, lat: 39.297, lon_end: -78.732, lat_end: 42.94 };
 * const routes = routeLines([leg], { x: "lon", y: "lat", xend: "lon_end", yend: "lat_end", team: "team", league: "nfl" });
 * // in the browser: map.addSource(routes.id, routes.source); map.addLayer(routes.layer)
 * routes.source.data.features[0]?.properties.color;
 * ```
 */
export function routeLines(rows: readonly Row[], o: RouteLineOptions): RouteLines {
  const width = checkPx("width", o.width ?? 3);
  const opacity = checkAlpha(o.alpha ?? 1);
  const id = o.id ?? "sdvplot-routes";
  const cols = [o.x, o.y, o.xend, o.yend].map((c, k) =>
    column(rows, c, ["x", "y", "xend", "yend"][k] as string),
  );
  const teams = column(rows, o.team, "team");
  const keep: number[] = [];
  const missing: Value[] = [];
  rows.forEach((_, i) => {
    if (cols.every((c) => real(c[i]))) keep.push(i);
    else missing.push(teams[i] as Value);
  });
  if (missing.length > 0) {
    const shown =
      missing.slice(0, 10).map(String).join(", ") +
      (missing.length > 10 ? ` and ${missing.length - 10} more` : "");
    warn(
      `maplibre:routes:${o.league}:missing:${shown}`,
      `skipped ${missing.length} route leg(s) with a missing coordinate: ${shown}`,
    );
  }
  const kept = keep.map((i) => teams[i] as Value);
  const ro = {
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  };
  const resolved = resolveSync(kept, o.league, ro);
  // keyed by the resolved team, so 12 and "12" (or "KC" and 12) are one team with one colour
  const keys = kept.map((t, j) => resolved[j] ?? `?${label(t)}`);
  const distinct = [...new Set(keys)];
  const known = distinct.filter((k) => !k.startsWith("?"));
  const palette = colorPalette(o.league, known, {
    ...ro,
    idSystem: "team_id",
    ...(o.which === undefined ? {} : { which: o.which }),
    ...(o.background === undefined ? {} : { background: o.background }),
    ...(o.fallback === undefined ? {} : { fallback: o.fallback }),
  });
  const colorOf = new Map(known.map((k, j) => [k, palette[j] as string]));
  const fallback = o.fallback ?? "#808080";
  const features = keep.map((i, j): Feature<LineGeometry, RouteProperties> => {
    const c = cols.map((col) => col[i] as number);
    return {
      type: "Feature",
      id: i,
      geometry: {
        type: "LineString",
        coordinates: [
          [c[0] as number, c[1] as number],
          [c[2] as number, c[3] as number],
        ],
      },
      properties: {
        team: resolved[j] ?? label(kept[j]),
        color: colorOf.get(keys[j] as string) ?? fallback,
        index: i,
      },
    };
  });
  return {
    id,
    source: { type: "geojson", data: { type: "FeatureCollection", features } },
    layer: {
      id,
      type: "line",
      source: id,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": width, "line-opacity": opacity },
    },
  };
}

/** OpenFreeMap's credit, exactly as its TileJSON (`https://tiles.openfreemap.org/planet`) gives it (read 2026-10-27). */
const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

/** `basemap`'s result. */
export interface Basemap {
  /** The style URL, for the map's `style` option. */
  style: string;
  /**
   * The provider's credit (HTML). MapLibre shows it by itself from the style's source, in its attribution control (on
   * by default; keep it). Anything else that draws these tiles, or a static export of the map, must show it.
   */
  attribution: string;
  /**
   * The colour of the style's `background` layer, the land (read from the style on 2026-10-27), for `routeLines`' and
   * `passArcLayer`'s `background` (dark mode). Their 3:1 contrast is measured against it, not against the water,
   * which is a little lighter on the dark style (#1b1b1d) and a little darker on the light one (#c2c8ca).
   */
  background: string;
}
const STYLES = {
  light: { style: "https://tiles.openfreemap.org/styles/positron", background: "#f2f3f0" },
  dark: { style: "https://tiles.openfreemap.org/styles/dark", background: "#0c0c0c" },
} as const;

/**
 * A free basemap that needs no API key: OpenFreeMap's `positron` (light) or `dark` vector style, built from
 * OpenStreetMap data. Pass `style` to `new maplibregl.Map({ style })`. OpenFreeMap's public instance asks for no
 * registration or key and sets no request limit; the credit is required, and MapLibre's attribution control shows it
 * from the style's source (`attribution` is the same text, for anything else). Each map view requests the
 * provider's tiles: build or test pages without a map, or serve a local style.
 *
 * @example
 * ```ts
 * import { basemap } from "@sportsdataverse/sdvplot/maplibre";
 *
 * const { style, background } = basemap("dark");
 * // in the browser: new maplibregl.Map({ container, style, center: [-96, 38], zoom: 3 })
 * [style, background];
 * ```
 */
export function basemap(theme: "light" | "dark" = "light"): Basemap {
  const s = STYLES[theme];
  if (s === undefined) throw new InputError(`theme is "light" or "dark", got ${JSON.stringify(theme)}`);
  return { ...s, attribution: OPENFREEMAP_ATTRIBUTION };
}

/**
 * What `logoSymbols` sets draw, as `[team, longitude, latitude, px, url]` per feature, in order: the module's test
 * hook, as the other adapters' `drawnMarks`.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { drawnMarks, logoSymbols } from "@sportsdataverse/sdvplot/maplibre";
 *
 * await loadLeague("nfl");
 * // 12 is Kansas City's ESPN team id
 * drawnMarks(logoSymbols([{ team: 12, lon: -94.714, lat: 39.297 }], { x: "lon", y: "lat", team: "team", league: "nfl" }));
 * ```
 */
export function drawnMarks(...sets: readonly LogoSymbols[]): DrawnMark[] {
  return sets.flatMap((s) => {
    const px = new Map(s.images.map((im) => [im.id, im.height]));
    return s.source.data.features.map(
      (f): DrawnMark => [
        f.properties.team,
        f.geometry.coordinates[0],
        f.geometry.coordinates[1],
        px.get(f.properties.icon) as number,
        f.properties.url,
      ],
    );
  });
}
