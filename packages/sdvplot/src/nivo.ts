/**
 * The nivo adapter: team colours as a chart's `colors`, team logos as a custom layer over a Bump, SwarmPlot or Chord
 * (`logoLayer`), and logos as the nodes themselves (`logoNode`, a SwarmPlot `circleComponent` or a Bump
 * `pointComponent`). Pure: nivo is never imported (the prop types here are structural, read from nivo 0.99); React's
 * `createElement` builds the SVG `<image>` each one returns. Call after `loadLeague(league)` / `preloadAll()`. The
 * ready-made chart is a component, `<LogoBump>` in `sdvplot/react`.
 */
import { type ReactElement, createElement } from "react";
import {
  type Row,
  aspect,
  checkAlpha,
  checkHeight,
  colorPalette,
  imageSource,
  place,
  seasons,
} from "./_web.js";
import { InputError, UnsupportedTargetError, warn } from "./errors.js";
import { type Placement, placedName } from "./placement.js";
import { type Value, resolveSync } from "./resolve.js";
import type { IdSystem, League, MarkType, SeasonInput, Variant, Which } from "./types.js";
export type { Row } from "./_web.js";
export { embedSources } from "./_web.js"; // public: build `embed` with it, as for the other adapters

/** A Bump point as nivo computes it: the subset read here. */
export interface NivoBumpPoint {
  /** The point's centre in px, inside the plot area. */
  x: number;
  y: number | null;
  /** Its diameter in px (the chart's `pointSize`). */
  size?: number;
  /** The series: `id`, and `data`, the series object the chart was given (with any extra fields). */
  serie: { id: string; data?: object };
}
/** A SwarmPlot node as nivo computes it: the subset read here. */
export interface NivoNode {
  /** The node's id (the chart's `id` accessor). */
  id: string;
  /** The node's centre in px, inside the plot area. */
  x: number;
  y: number;
  /** Its diameter in px (the chart's `size`). */
  size?: number;
  /** The datum the node was drawn from. */
  data?: unknown;
}
/** A Chord arc as nivo computes it: the subset read here. Angles in radians, clockwise from 12 o'clock. */
export interface NivoArc {
  /** The arc's key (the chart's `keys`). */
  id: string;
  startAngle: number;
  endAngle: number;
}
/** What nivo hands a custom layer of a Bump (`points`), a SwarmPlot (`nodes`) or a Chord (`arcs`): the subset read. */
export interface NivoLayerProps {
  /** The plot area's height in px (Bump, SwarmPlot). */
  innerHeight?: number;
  /** A Bump's points (only those with a rank: a `null` y has none). */
  points?: readonly NivoBumpPoint[];
  /** A SwarmPlot's nodes. */
  nodes?: readonly NivoNode[];
  /** A Chord's arcs. */
  arcs?: readonly NivoArc[];
  /** The Chord's centre in px: half the plot area's width and height. */
  center?: readonly [number, number];
  /** The Chord ring's outer radius in px. */
  radius?: number;
}
/** A nivo custom layer: an SVG group of logos. */
export type NivoLayer = (props: NivoLayerProps) => ReactElement | null;
/** What nivo hands a SwarmPlot `circleComponent` (`node`) or a Bump `pointComponent` (`point`): the subset read. */
export interface NivoNodeProps {
  /** A SwarmPlot `circleComponent`'s node. */
  node?: NivoNode;
  /** A Bump `pointComponent`'s point. */
  point?: NivoBumpPoint;
}
/** A node component: the logo, or an empty group where none can be drawn (nivo's types want an element). */
export type NivoNodeComponent = (props: NivoNodeProps) => ReactElement;

interface Shared {
  /** The league the teams belong to, e.g. "nfl". */
  league: League;
  /**
   * The field holding the team (abbreviation, name or id; see `idSystem`): read from a Bump series' object or a
   * SwarmPlot node's datum. Default: the series' or node's `id`. A Chord arc is read by its id (the chart's `keys`).
   */
  team?: string;
  /** A season (number or string) for every team, or the name of the field holding each one's season. */
  season?: SeasonInput;
  /** Opacity in [0, 1]. Default 1. */
  alpha?: number;
  /** Logo variant, e.g. "dark". Default "default". */
  variant?: Variant;
  /** How the team values are read. Default "auto". */
  idSystem?: IdSystem;
  /** "logo" (default) or "wordmark". */
  markType?: MarkType;
  /** url → data URI map from `embedSources`, to inline the images. */
  embed?: ReadonlyMap<string, string>;
}
/** `logoLayer` options. */
export interface NivoLayerOptions extends Shared {
  /**
   * Image height as a fraction of the plot area's height, in (0, 1] (nivo hands a layer the plot's `innerHeight`, so
   * a px value is refused). Default 0.08.
   */
  height?: number;
  /** Which of a Bump series' points get a logo: "last" (default: the end of each line), "first" or "all". */
  at?: "last" | "first" | "all";
}
/** `logoNode` options: the logo is as tall as nivo sized the node (the chart's `size` / `pointSize`). */
export type NivoNodeOptions = Shared;

const AT = ["last", "first", "all"] as const;
const CHORD_GAP = 4; // px between a Chord's ring and its logos

interface Target {
  x: number;
  y: number;
  raw: Value;
  row: Row;
}
const field = (id: string, data: unknown, team: string | undefined): Value =>
  (team === undefined ? id : ((data ?? {}) as Row)[team]) as Value;

/** The `<image>` of a placed mark, `h` px tall, centred on (x, y), stamped with what `sdvplot/testing`'s
 *  `drawnMarks` reads back (`frame`: the plot height a layer's fraction is of, 1 for a node's px). */
function image(p: Placement, o: Shared, at: Target, h: number, frame: number, alpha: number): ReactElement {
  const kind = o.markType ?? "logo";
  const w = h * aspect(p);
  return createElement("image", {
    key: `${p.index}`,
    href: imageSource(p, o.embed),
    x: at.x - w / 2,
    y: at.y - h / 2,
    width: w,
    height: h,
    preserveAspectRatio: "xMidYMid meet",
    ...(alpha === 1 ? {} : { opacity: alpha }),
    role: "img",
    "aria-label": `${placedName(p, o.league, at.raw)} ${kind}`,
    "data-sdv-id": p.id,
    "data-sdv-kind": kind,
    "data-sdv-x": String(at.x),
    "data-sdv-y": String(at.y),
    "data-sdv-frame": String(frame),
  });
}

/** placeSync over the targets; a target with no mark is dropped with one warning, as sdvplot/echarts does. */
function placed(ts: readonly Target[], o: Shared): Placement[] {
  const season = seasons(
    ts.map((t) => t.row),
    o.season,
  );
  return place(
    ts.map((t) => t.x),
    ts.map((t) => t.y),
    ts.map((t) => t.raw),
    {
      league: o.league,
      kind: o.markType ?? "logo",
      ...(season === undefined ? {} : { season }),
      ...(o.variant === undefined ? {} : { variant: o.variant }),
      ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
    },
  );
}

/** Each Bump series' first or last point, or every point. Points with no rank (y null) are not in `points`. */
function bumpPoints(points: readonly NivoBumpPoint[], at: (typeof AT)[number]): NivoBumpPoint[] {
  if (at === "all") return [...points];
  const pick = new Map<string, NivoBumpPoint>();
  for (const p of points) if (at === "last" || !pick.has(p.serie.id)) pick.set(p.serie.id, p);
  return [...pick.values()];
}

/**
 * Team logos as a nivo custom layer: add it to a chart's `layers`, after the built-in ones it should sit over.
 * - Bump: a logo at each series' last point (`at` picks the first, or every point), the team read from the series'
 *   `id` (or its `team` field).
 * - SwarmPlot: a logo at every node, the team read from the node's `id` (or its datum's `team` field).
 * - Chord: a logo outside the ring at the middle of each arc, the team read from the arc's id (the chart's `keys`).
 *
 * Logos are `height` × the plot height tall. Given your own `layers`, put the logo layer before `"mesh"`; appended after
 * it, it is harmless (its group has `pointer-events: none`, so the mesh still gets the mouse). A team with no logo draws nothing and warns once, as `sdvplot/echarts`
 * does. The logos sit at nivo's final positions: they do not tween with `animate`.
 *
 * @example
 * ```tsx
 * import { SwarmPlot } from "@nivo/swarmplot";
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { logoLayer, teamColors } from "@sportsdataverse/sdvplot/nivo";
 *
 * await loadLeague("nfl");
 * const rows = [
 *   { team: "KC", pf: 385 },
 *   { team: "LAC", pf: 402 },
 *   { team: "DEN", pf: 425 },
 * ];
 * <SwarmPlot
 *   width={500}
 *   height={200}
 *   data={rows.map((r) => ({ ...r, group: "AFC West" }))}
 *   groups={["AFC West"]}
 *   id="team"
 *   value="pf"
 *   size={10}
 *   colors={teamColors({ league: "nfl" })}
 *   layers={["grid", "axes", "circles", logoLayer({ league: "nfl", height: 0.2 })]}
 * />;
 * ```
 */
export function logoLayer(o: NivoLayerOptions): NivoLayer {
  const height = checkHeight(o.height ?? 0.08);
  const alpha = checkAlpha(o.alpha ?? 1);
  const at = o.at ?? "last";
  if (!AT.includes(at))
    throw new InputError(`at must be "last", "first" or "all", got ${JSON.stringify(at)}`);
  return function SdvLogoLayer(props) {
    let frame: number;
    let ts: Target[];
    let chord: { cx: number; cy: number; radius: number; mids: number[] } | undefined;
    if (props.points !== undefined) {
      frame = props.innerHeight ?? 0;
      ts = bumpPoints(props.points, at).flatMap((p) =>
        p.y === null
          ? []
          : [
              {
                x: p.x,
                y: p.y,
                raw: field(p.serie.id, p.serie.data, o.team),
                row: (p.serie.data ?? {}) as Row,
              },
            ],
      );
    } else if (props.nodes !== undefined) {
      frame = props.innerHeight ?? 0;
      ts = props.nodes.map((n) => ({
        x: n.x,
        y: n.y,
        raw: field(n.id, n.data, o.team),
        row: (n.data ?? {}) as Row,
      }));
    } else if (props.arcs !== undefined && props.center !== undefined && props.radius !== undefined) {
      const [cx, cy] = props.center;
      frame = 2 * cy; // nivo centres the chord in the plot area
      // placed below, once each mark's aspect is known
      chord = { cx, cy, radius: props.radius, mids: props.arcs.map((a) => (a.startAngle + a.endAngle) / 2) };
      ts = props.arcs.map((a) => ({ x: cx, y: cy, raw: a.id as Value, row: {} }));
    } else
      throw new UnsupportedTargetError(
        `logoLayer draws on a nivo Bump (points), SwarmPlot (nodes) or Chord (arcs) layer; got props ${Object.keys(props).join(", ")}`,
      );
    const ps = placed(ts, o);
    if (chord !== undefined)
      for (const p of ps) {
        // clear the ring by the mark's half-extent along its radius: a w x h box reaches |sin m| w/2 + |cos m| h/2
        const m = chord.mids[p.index] as number;
        const h = height * frame;
        const r =
          chord.radius + (Math.abs(Math.sin(m)) * h * aspect(p)) / 2 + (Math.abs(Math.cos(m)) * h) / 2;
        const t = ts[p.index] as Target;
        t.x = chord.cx + (r + CHORD_GAP) * Math.sin(m);
        t.y = chord.cy - (r + CHORD_GAP) * Math.cos(m);
      }
    return createElement(
      "g",
      { "data-sdv-layer": "logos", pointerEvents: "none" }, // the lines and nodes under it keep their mouse events
      ps.map((p) => image(p, o, ts[p.index] as Target, height * frame, frame, alpha)),
    );
  };
}

/**
 * Team logos as the nodes themselves: a SwarmPlot's `circleComponent` or a Bump's `pointComponent`. Each logo is as
 * tall as nivo sized the node (the chart's `size` or `pointSize`, in px) and replaces its circle; the team is read as
 * `logoLayer` reads it. A team with no logo draws nothing and warns once. The logo sits at the node's final position:
 * it does not tween with `animate`.
 */
export function logoNode(o: NivoNodeOptions): NivoNodeComponent {
  if ("height" in o)
    throw new InputError(
      "logoNode takes no height: each logo is as tall as nivo sized the node (the chart's size or pointSize, in px)",
    );
  const alpha = checkAlpha(o.alpha ?? 1);
  return function SdvLogoNode({ node, point }) {
    const n = node ?? point;
    const t: Target | undefined =
      n === undefined || n.y === null
        ? undefined
        : node !== undefined
          ? { x: node.x, y: node.y, raw: field(node.id, node.data, o.team), row: (node.data ?? {}) as Row }
          : point !== undefined && point.y !== null
            ? {
                x: point.x,
                y: point.y,
                raw: field(point.serie.id, point.serie.data, o.team),
                row: (point.serie.data ?? {}) as Row,
              }
            : undefined;
    const size = n?.size ?? 0;
    const p = t === undefined || !(size > 0) ? undefined : placed([t], o)[0];
    // ponytail: the frame is 1, so drawnMarks' height reads in px (a node component gets no plot height)
    return p === undefined
      ? createElement("g")
      : createElement("g", null, image(p, o, t as Target, size, 1, alpha));
  };
}

/** `teamColors` options. */
export interface NivoColorOptions {
  /** The league the teams belong to, e.g. "nfl". */
  league: League;
  /**
   * The field holding the team: read from the datum nivo hands `colors` (a Bump series, a Chord arc), else from its
   * `data` (a SwarmPlot node's datum). Default "id".
   */
  by?: string;
  /** Every team the chart draws, in order. Needed with `background`: the palette keeps them apart from each other. */
  teams?: readonly unknown[];
  /** "primary" (default) or "secondary" colour. */
  which?: Which;
  /** The season the teams are resolved for (a number or string). */
  season?: SeasonInput;
  /** How the team values are read. Default "auto". */
  idSystem?: IdSystem;
  /** The colour of an unresolved team. Default "#808080". */
  fallback?: string;
  /**
   * The chart's background. Given, a team colour under 3:1 contrast against it is swapped for the team's other
   * colour, else moved towards white (on a dark background) or black (a light one) until it reads: dark mode. A
   * colour that would then sit too close to an earlier team's (CIE76 ΔE under 20) takes the team's other colour, or
   * the nearest colour to its own (lightness, hue or chroma stepped) that is distinct and still reads; failing that it
   * is kept, with one warning.
   */
  background?: string;
}
/**
 * A nivo `colors` accessor: each datum's team colour. A Bump series and a Chord arc are read by `id`; for a SwarmPlot
 * pass `by: "<team field>"`. With `background` (and `teams`), every colour keeps 3:1 contrast against it (dark mode)
 * and aims to stay distinct from the others (when it cannot, it keeps the readable colour and warns once).
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamColors } from "@sportsdataverse/sdvplot/nivo";
 *
 * await loadLeague("nfl");
 * const colors = teamColors({ league: "nfl", teams: ["KC", "LAC", "DEN", "LV"], background: "#181a1b" });
 * ["KC", "LAC", "DEN", "LV"].map((id) => colors({ id }));
 * ```
 */
export function teamColors(o: NivoColorOptions): (datum: object) => string {
  const fallback = o.fallback ?? "#808080";
  const by = o.by ?? "id";
  const co = {
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  };
  const read = (d: object): unknown => {
    const r = d as Row;
    return r[by] ?? (r.data !== null && typeof r.data === "object" ? (r.data as Row)[by] : undefined);
  };
  const po = { ...co, ...(o.which === undefined ? {} : { which: o.which }), fallback };
  if (o.background === undefined) return (d) => colorPalette(o.league, [read(d)], po)[0] as string;
  if (o.teams === undefined)
    throw new InputError(
      "teamColors: background needs teams, every team the chart draws (the palette keeps them apart)",
    );
  const teams = o.teams;
  // the shared palette, over the resolved teams: an alias or an unresolved value takes no slot of its own
  const palette = colorPalette(o.league, teams, { ...po, background: o.background });
  const ids = resolveSync(teams as readonly Value[], o.league, co);
  const byId = new Map<string, string>();
  ids.forEach((id, i) => {
    if (id !== undefined && !byId.has(id)) byId.set(id, palette[i] as string);
  });
  return (d) => {
    const raw = read(d) as Value;
    const id = resolveSync([raw], o.league, co)[0];
    const c = id === undefined ? undefined : byId.get(id);
    if (c === undefined && id !== undefined)
      warn(
        `nivo:teamColors:${o.league}:${id}`,
        `teamColors: ${String(raw)} is not in teams: drawn in the fallback`,
      );
    return c ?? fallback;
  };
}
