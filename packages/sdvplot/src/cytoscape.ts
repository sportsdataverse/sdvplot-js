/**
 * The Cytoscape.js adapter: passing networks as Cytoscape elements and a team-coloured stylesheet. Pure: it never
 * imports cytoscape (3.34.3 or later is an optional peer), so the network can be built anywhere, a server included,
 * and handed to the library as plain JSON: `cytoscape({ container, elements, style, layout: { name: "preset" } })`.
 * Sizes are Cytoscape style units, px at zoom 1: a node's diameter, an edge's width. Synchronous: call after
 * `loadLeague(league)` / `preloadAll()` (and `loadGsis()` for gsis headshots).
 */
import { type Row, colorList, column } from "./_web.js";
import { hex6, onColor } from "./contrast.js";
import { InputError, warn } from "./errors.js";
import { ESPN_HEADSHOT_LEAGUES, type EspnHeadshotLeague, headshotUrl } from "./headshots.js";
import { type Value, resolveSync } from "./resolve.js";
import { teamPalette } from "./team-palette.js";
import type { IdSystem, League, SeasonInput, Which } from "./types.js";

export type { Row } from "./_web.js";

/** A player node. `classes` is "headshot" (its image drawn as the node) or "initials" (team colour and initials). */
export interface CyNode {
  data: {
    /** The player id, as text. */
    id: string;
    /** The player's name, else the id. */
    label: string;
    /** The first letters of the name's first and last words, else the id. */
    initials: string;
    /** The resolved team id; absent when the team does not resolve (the node keeps the fallback colour). */
    team?: string;
    /** The headshot URL, on a headshot node only. */
    image?: string;
  };
  /** Where the player stood (with the x/y/xend/yend options): model px, y down. */
  position?: { x: number; y: number };
  classes: "headshot" | "initials";
}
/** A directed edge from passer to receiver. */
export interface CyEdge {
  data: {
    /** The source and target ids joined by an arrow, as in 5485-\>3099 (Varane to Lloris). */
    id: string;
    /** The passer's node id. */
    source: string;
    /** The receiver's node id. */
    target: string;
    /** The pair's passes (or summed `weight`). */
    weight: number;
    /** The edge's width in px: `edgeWidth` for the heaviest pair, the others in proportion to their weight. */
    width: number;
    /** The passer's resolved team id; absent when it does not resolve. */
    team?: string;
  };
}
/** One stylesheet block, Cytoscape's `{ selector, style }` JSON. */
export interface StyleBlock {
  selector: string;
  style: Record<string, string | number>;
}
/** `passNetwork`'s result: what `cytoscape({ elements, style })` takes. */
export interface PassNetwork {
  elements: { nodes: CyNode[]; edges: CyEdge[] };
  style: StyleBlock[];
}

/** The colour options `teamStylesheet` and `passNetwork` share. */
export interface CyColorOptions {
  /** The season the teams are resolved for. */
  season?: SeasonInput;
  /** How the team values are read. Default "auto". */
  idSystem?: IdSystem;
  /** The team colour drawn, "primary" (default) or "secondary". */
  which?: Which;
  /**
   * The background the network is drawn on (Cytoscape's container). Given, every team colour keeps 3:1 contrast
   * against it (dark mode) and stays distinct (CIE76 ΔE of 20 or more) from every other team's, through the shared team
   * palette, as `teamColorPalette` does in the other adapters; a headshot node's name takes the ink that reads on it.
   */
  background?: string;
  /** The colour of an element whose team does not resolve, or has no colour. Default "#808080". */
  fallback?: string;
  /** A node's diameter in px, 1 or more. Default 40. */
  nodeSize?: number;
}
/** `teamStylesheet` options. */
export interface TeamStylesheetOptions extends CyColorOptions {
  /** The league the teams belong to, e.g. "soccer". */
  league: League;
  /** The teams to colour, as the elements name them before resolving (see `idSystem`). */
  teams: readonly unknown[];
}
/** `passNetwork` options. */
export interface PassNetworkOptions extends CyColorOptions {
  /** Name of the row column holding the passer's player id. */
  from: string;
  /** Name of the row column holding the receiver's player id. */
  to: string;
  /** Name of the row column holding the passing team (abbreviation, name or id; see `idSystem`). */
  team: string;
  /** The league the teams belong to, e.g. "soccer"; also the league of the headshots. */
  league: League;
  /** Name of the row column holding the passer's name (the node's label and initials). Default: the id. */
  fromName?: string;
  /** Name of the row column holding the receiver's name. Default: the id. */
  toName?: string;
  /** Name of a row column summed per pair in place of counting rows. */
  weight?: string;
  /** Pairs with a smaller weight are left out (every player stays). Default 1. */
  minWeight?: number;
  /** With `y`, `xend` and `yend`: the row columns of each pass's start (x, y) and end; all four or none. */
  x?: string;
  /** The pass start's y (up, as on a plot). */
  y?: string;
  /** The pass end's x. */
  xend?: string;
  /** The pass end's y. */
  yend?: string;
  /** Model px per data unit of x and y, more than 0. Default 10 (a 105 m pitch is 1,050 px across at zoom 1). */
  scale?: number;
  /**
   * Which ids `from` and `to` hold, for headshots: "espn" (default; ESPN athlete ids) or "gsis" (nflverse; needs
   * `loadGsis()` first). `false` draws every player as initials and warns about none. A player with no headshot (a
   * league without ESPN headshots, such as soccer, or an id that does not resolve) is drawn as initials, with one
   * warning naming them.
   */
  headshots?: "espn" | "gsis" | false;
  /** The heaviest pair's edge width in px, 1 or more. Default 10. */
  edgeWidth?: number;
}

const real = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
function checkPx(name: string, v: unknown): number {
  if (!real(v) || v < 1)
    throw new InputError(
      `${name} is in px (Cytoscape style units), 1 or more, not a fraction; got ${String(v)}`,
    );
  return v;
}
/** A player id as text: a number as JS prints it (no ".0"), a string trimmed; missing or empty is null. */
function playerId(v: unknown): string | null {
  if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
/** The first letters of a name's first and last words ("Kylian Mbappé" KM, "N'Golo Kanté" NK); one word: its first. */
function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((w) => w !== "");
  return words
    .filter((_, i) => i === 0 || i === words.length - 1)
    .map((w) => (Array.from(w)[0] as string).toUpperCase())
    .join("");
}
const shownList = (v: readonly unknown[]): string =>
  v.slice(0, 10).map(String).join(", ") + (v.length > 10 ? ` and ${v.length - 10} more` : "");

/**
 * A Cytoscape stylesheet that draws elements in team colours: a node whose `data.team` is a team's id is filled with
 * its colour (a headshot node shows the colour as its border), its initials in the ink that reads on it, and an edge
 * with that `data.team` is stroked in it, arrow included. The base blocks draw `passNetwork`'s elements: node size,
 * headshot nodes (`data.image` as the background, the name below), initials nodes, directed bezier edges as wide as
 * `data.width` px. Elements whose team does not resolve take `fallback`. `data.team` holds the resolved team id, as
 * `passNetwork` writes it; for your own elements, resolve the ids first (or pass `idSystem: "team_id"`).
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { teamStylesheet } from "@sportsdataverse/sdvplot/cytoscape";
 *
 * await loadLeague("nfl");
 * const style = teamStylesheet({ league: "nfl", teams: ["KC", "PHI"], background: "#181a1b" });
 * // in the browser: cytoscape({ container, elements, style })
 * style.length;
 * ```
 */
export function teamStylesheet(o: TeamStylesheetOptions): StyleBlock[] {
  const size = checkPx("nodeSize", o.nodeSize ?? 40);
  const fallback = hex6(o.fallback ?? "#808080", { dropAlpha: true });
  const ink = onColor(hex6(o.background ?? "#ffffff"));
  const ro = {
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  };
  // one rule per distinct team, in order of first appearance; a team that does not resolve gets none, so it never
  // moves a real team's colour
  const ids: string[] = [];
  for (const id of resolveSync(o.teams as readonly Value[], o.league, ro))
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  const which = o.which ?? "primary";
  const co = { idSystem: "team_id" as const, ...(o.season === undefined ? {} : { season: o.season }) };
  const main = colorList(o.league, ids, { ...co, which });
  const other = colorList(o.league, ids, { ...co, which: which === "primary" ? "secondary" : "primary" });
  let colors = main.map((c, i) => hex6(c ?? other[i] ?? fallback, { dropAlpha: true }));
  if (o.background !== undefined) colors = teamPalette(colors, other, hex6(o.background), ids);
  const base: StyleBlock[] = [
    {
      selector: "node",
      style: {
        width: size,
        height: size,
        "background-color": fallback,
        "border-width": 3,
        "border-color": fallback,
        "font-size": 12,
      },
    },
    {
      selector: "node.initials",
      style: {
        label: "data(initials)",
        "text-valign": "center",
        "text-halign": "center",
        "font-size": Math.max(8, Math.round(size * 0.36)),
        "font-weight": "bold",
        color: onColor(fallback),
      },
    },
    {
      selector: "node.headshot",
      style: {
        "background-image": "data(image)",
        "background-fit": "cover",
        "background-clip": "node",
        label: "data(label)",
        "text-valign": "bottom",
        "text-halign": "center",
        "text-margin-y": 4,
        color: ink,
      },
    },
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
        "line-color": fallback,
        "target-arrow-color": fallback,
      },
    },
    { selector: "edge[width]", style: { width: "data(width)" } },
  ];
  const teams = ids.flatMap((id, i): StyleBlock[] => {
    const c = colors[i] as string;
    const at = `[team = ${JSON.stringify(id)}]`;
    return [
      { selector: `node${at}`, style: { "background-color": c, "border-color": c } },
      { selector: `node.initials${at}`, style: { color: onColor(c) } },
      { selector: `edge${at}`, style: { "line-color": c, "target-arrow-color": c } },
    ];
  });
  return [...base, ...teams];
}

/**
 * A passing network as Cytoscape elements and stylesheet: one node per player, one directed edge per passer to
 * receiver pair, weighted by its passes (a row is a pass; `weight` sums a column instead) and as wide as that weight
 * (`edgeWidth` px for the heaviest pair, the others in proportion), stroked in the passing team's colour with an arrow at
 * the receiver. A player whose headshot resolves is drawn as it (`background-image`), with the name below; any other is
 * a node in the team's colour with the name's initials, the clean fallback, with one warning naming those players
 * (soccer has no headshots, so every soccer player is this node; `headshots: false` asks for none). With x, y, xend and
 * yend, each node sits at the mean of where the player passed from and received (y up, flipped for Cytoscape's y-down
 * model, `scale` px per unit): draw it with the `preset` layout. Without them, use a layout such as `cose`. A row with
 * no passer, no receiver or a missing coordinate is left out with one warning. The stylesheet is `teamStylesheet`'s.
 *
 * @example
 * ```ts
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { passNetwork } from "@sportsdataverse/sdvplot/cytoscape";
 *
 * await loadLeague("nfl");
 * // Patrick Mahomes to Xavier Worthy, a Super Bowl LIX touchdown (ESPN athlete ids)
 * const pass = { from: 3139477, from_name: "Patrick Mahomes", to: 4683062, to_name: "Xavier Worthy", team: "KC" };
 * const { elements, style } = passNetwork([pass], {
 *   from: "from",
 *   to: "to",
 *   fromName: "from_name",
 *   toName: "to_name",
 *   team: "team",
 *   league: "nfl",
 * });
 * // in the browser: cytoscape({ container, elements, style, layout: { name: "cose" } })
 * elements.nodes[0]?.data.image;
 * ```
 */
export function passNetwork(rows: readonly Row[], o: PassNetworkOptions): PassNetwork {
  const edgeWidth = checkPx("edgeWidth", o.edgeWidth ?? 10);
  checkPx("nodeSize", o.nodeSize ?? 40);
  const minWeight = o.minWeight ?? 1;
  if (!real(minWeight) || minWeight < 0)
    throw new InputError(`minWeight is 0 or more, got ${String(minWeight)}`);
  const at = [o.x, o.y, o.xend, o.yend];
  const placed = at.every((c) => c !== undefined);
  if (!placed && at.some((c) => c !== undefined))
    throw new InputError("x, y, xend and yend place the players together: give all four or none");
  const scale = o.scale ?? 10;
  if (!real(scale) || scale <= 0)
    throw new InputError(`scale is px per data unit, more than 0, got ${String(scale)}`);
  const from = column(rows, o.from, "from");
  const to = column(rows, o.to, "to");
  const teams = column(rows, o.team, "team");
  const names = (c: string | undefined, what: string) =>
    c === undefined ? undefined : column(rows, c, what);
  const fromName = names(o.fromName, "fromName");
  const toName = names(o.toName, "toName");
  const weights = o.weight === undefined ? undefined : column(rows, o.weight, "weight");
  const xy = placed
    ? at.map((c, k) => column(rows, c as string, ["x", "y", "xend", "yend"][k] as string))
    : [];
  const ro = {
    ...(o.season === undefined ? {} : { season: o.season }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  };
  const resolved = resolveSync(teams, o.league, ro);

  type Player = { label: string; team: string | undefined; xs: number[]; ys: number[] };
  const players = new Map<string, Player>();
  const pairs = new Map<
    string,
    { source: string; target: string; weight: number; team: string | undefined }
  >();
  const skipped: Value[] = [];
  const meet = (id: string, name: unknown, team: string | undefined, x?: number, y?: number): void => {
    let p = players.get(id);
    if (p === undefined) {
      const n = name === null || name === undefined ? "" : String(name).trim();
      p = { label: n === "" ? id : n, team, xs: [], ys: [] };
      players.set(id, p);
    }
    if (x !== undefined && y !== undefined) {
      p.xs.push(x);
      p.ys.push(y);
    }
  };
  rows.forEach((_, i) => {
    const a = playerId(from[i]);
    const b = playerId(to[i]);
    const c = xy.map((col) => col[i]);
    const w = weights === undefined ? 1 : weights[i];
    if (a === null || b === null || !c.every(real) || !real(w)) {
      skipped.push(a ?? b ?? i);
      return;
    }
    const team = resolved[i];
    const [x0, y0, x1, y1] = c as number[];
    meet(a, fromName?.[i], team, x0, y0);
    meet(b, toName?.[i], team, x1, y1);
    const key = `${a}->${b}`;
    const pair = pairs.get(key) ?? { source: a, target: b, weight: 0, team };
    pair.weight += w;
    pairs.set(key, pair);
  });
  if (skipped.length > 0)
    warn(
      `cytoscape:passes:${o.league}:${shownList(skipped)}`,
      `skipped ${skipped.length} pass(es) with no passer, no receiver, or a missing coordinate or weight: ${shownList(skipped)}`,
    );

  const hl = o.headshots === false || !Object.hasOwn(ESPN_HEADSHOT_LEAGUES, o.league) ? undefined : o.league;
  const noImage: string[] = [];
  const mean = (v: readonly number[]): number => v.reduce((s, x) => s + x, 0) / v.length;
  const nodes = [...players].map(([id, p]): CyNode => {
    const image =
      hl === undefined
        ? undefined
        : headshotUrl(id, hl as EspnHeadshotLeague, { idSystem: o.headshots === "gsis" ? "gsis" : "espn" });
    if (image === undefined && o.headshots !== false) noImage.push(p.label);
    return {
      data: {
        id,
        label: p.label,
        initials: p.label === id ? id : initialsOf(p.label),
        ...(p.team === undefined ? {} : { team: p.team }),
        ...(image === undefined ? {} : { image }),
      },
      ...(placed ? { position: { x: scale * mean(p.xs), y: -scale * mean(p.ys) } } : {}),
      classes: image === undefined ? "initials" : "headshot",
    };
  });
  if (noImage.length > 0)
    warn(
      `cytoscape:headshots:${o.league}:${shownList(noImage)}`,
      `drew ${noImage.length} player(s) with no headshot as team-coloured initials: ${shownList(noImage)}`,
    );
  const kept = [...pairs.values()].filter((p) => p.weight >= minWeight);
  const heaviest = Math.max(0, ...kept.map((p) => p.weight));
  const edges = kept.map(
    (p): CyEdge => ({
      data: {
        id: `${p.source}->${p.target}`,
        source: p.source,
        target: p.target,
        weight: p.weight,
        width: heaviest > 0 ? (edgeWidth * p.weight) / heaviest : edgeWidth,
        ...(p.team === undefined ? {} : { team: p.team }),
      },
    }),
  );
  const colors = Object.fromEntries(
    (["season", "which", "background", "fallback", "nodeSize"] as const).flatMap((k) =>
      o[k] === undefined ? [] : [[k, o[k]]],
    ),
  ) as CyColorOptions;
  const style = teamStylesheet({
    ...colors,
    league: o.league,
    teams: [...new Set(resolved)].filter((t) => t !== undefined),
    idSystem: "team_id",
  });
  return { elements: { nodes, edges }, style };
}
