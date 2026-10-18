import { type ComponentType, type ReactElement, Suspense, createElement, lazy } from "react";
import { type Row, aspect, checkAlpha, imageSource, place, seasons } from "../_web.js";
import { InputError, OptionalDependencyError, UnsupportedTargetError, warn } from "../errors.js";
import { type Placement, placedName } from "../placement.js";
import type { Value } from "../resolve.js";
import type { IdSystem, League, MarkType, SeasonInput, Variant } from "../types.js";

interface Shared {
  /** The league the teams belong to, e.g. "nfl". */
  league: League;
  /** Logo variant, e.g. "dark". Default "default". */
  variant?: Variant;
  /** How the team values are read. Default "auto". */
  idSystem?: IdSystem;
  /** "logo" (default) or "wordmark". */
  markType?: MarkType;
  /** url → data URI map from `embedSources`, to inline the images. */
  embed?: ReadonlyMap<string, string>;
}
/**
 * `<LogoPoint>` props: yours (the league, the datum field holding the team, ...), plus the point Victory hands its
 * `dataComponent` (`x`, `y`, `size`, `datum`, `events`), which you leave out.
 */
export interface LogoPointProps extends Shared {
  /** The field of each datum (each data row) holding the team: abbreviation, name or id (see `idSystem`). */
  team: string;
  /** A season (number or string) for every point, or the name of the datum field holding each one's season. */
  season?: SeasonInput;
  /** Opacity in [0, 1]. Default 1. */
  alpha?: number;
  /** Set by Victory: the point's centre in px. */
  x?: number;
  /** Set by Victory: the point's centre in px. */
  y?: number;
  /** Set by Victory: the point's radius in px (the scatter's `size`). The logo is twice it tall. */
  size?: number;
  /** Set by Victory: the data row the point was drawn from. */
  datum?: object;
  /** Set by Victory: the point's event handlers (tooltips, voronoi, your `events`). */
  events?: object;
}
/**
 * `<LogoTick>` props: yours (the league, the logo size, ...), plus the tick label Victory hands its
 * `tickLabelComponent` (`x`, `y`, `text`, the anchors, and VictoryLabel's other props), which you leave out.
 */
export interface LogoTickProps extends Shared {
  /** The season the axis' teams are resolved for. */
  season?: SeasonInput;
  /** The logo's height in px, 1 or more (Victory hands a tick label no plot height). Default 24. */
  size?: number;
  /** Set by Victory: the label's anchor in px. */
  x?: number;
  /** Set by Victory: the label's anchor in px. */
  y?: number;
  /** Set by Victory: the tick's label, the team (abbreviation, name or id; see `idSystem`). */
  text?: unknown;
  /** Set by Victory: which side of the anchor the label would run. VictoryLabel's default "start". */
  textAnchor?: string;
  /** Set by Victory: which side of the anchor the label would hang. VictoryLabel's default "middle". */
  verticalAnchor?: string;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function checkSize(size: unknown): number {
  if (!(isNum(size) && size > 0))
    throw new InputError(`size is an image height in px > 0, got ${String(size)}`);
  if (size < 1)
    throw new InputError(
      `size is a height in px, not a fraction of the plot (echarts' \`height\`): got ${size}, which draws a sub-pixel image`,
    );
  return size;
}

function placed(
  x: number,
  y: number,
  raw: Value,
  rows: readonly Row[],
  o: Shared & { season?: SeasonInput },
) {
  const season = seasons(rows, o.season);
  return place([x], [y], [raw], {
    league: o.league,
    kind: o.markType ?? "logo",
    ...(season === undefined ? {} : { season }),
    ...(o.variant === undefined ? {} : { variant: o.variant }),
    ...(o.idSystem === undefined ? {} : { idSystem: o.idSystem }),
  })[0];
}

/** The `<image>` of a placed mark, `h` px tall with its top-left at (left, top), stamped with what `sdvplot/testing`'s
 *  `drawnMarks` reads back. ponytail: the frame is 1 px, so drawnMarks' `height` reads in px (no plot height here). */
function image(
  p: Placement,
  o: Shared,
  raw: Value,
  box: { left: number; top: number; h: number },
  at: { x: number; y: number },
  extra: object,
): ReactElement {
  const kind = o.markType ?? "logo";
  return createElement("image", {
    ...extra,
    href: imageSource(p, o.embed),
    x: box.left,
    y: box.top,
    width: box.h * aspect(p),
    height: box.h,
    preserveAspectRatio: "xMidYMid meet",
    role: "img",
    "aria-label": `${placedName(p, o.league, raw)} ${kind}`,
    "data-sdv-id": p.id,
    "data-sdv-kind": kind,
    "data-sdv-x": String(at.x),
    "data-sdv-y": String(at.y),
    "data-sdv-frame": "1",
  });
}

/**
 * Team logos as a Victory scatter's points: `<VictoryScatter dataComponent={<LogoPoint league team />}>`. Each point
 * draws the logo of its datum's `team` field, centred on the point and as tall as the point it replaces (twice the
 * scatter's `size`, in px: set `size` on the `VictoryScatter`). A team with no logo draws nothing and warns once, as
 * `sdvplot/echarts` does. Victory's event handlers (tooltips, voronoi) stay on the image. Synchronous: call it after
 * `loadLeague(league)`. Needs nothing from victory itself, so it also renders on the server.
 *
 * @example
 * ```tsx
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { LogoPoint } from "@sportsdataverse/sdvplot/react";
 * import { VictoryChart, VictoryScatter } from "victory";
 *
 * await loadLeague("nfl");
 * const rows = [
 *   { team: "KC", pf: 385, pa: 326 },
 *   { team: "LAC", pf: 402, pa: 301 },
 *   { team: "DEN", pf: 425, pa: 311 },
 * ];
 * <VictoryChart domainPadding={30}>
 *   <VictoryScatter data={rows} x="pf" y="pa" size={14} dataComponent={<LogoPoint league="nfl" team="team" />} />
 * </VictoryChart>;
 * ```
 */
export function LogoPoint(props: LogoPointProps): ReactElement | null {
  if ("height" in props)
    throw new InputError(
      "LogoPoint takes no height: each logo is as tall as Victory drew the point (twice the scatter's size, in px)",
    );
  const alpha = checkAlpha(props.alpha ?? 1);
  const { x, y, size } = props;
  if (!(isNum(x) && isNum(y) && isNum(size)))
    throw new UnsupportedTargetError(
      "LogoPoint is a VictoryScatter dataComponent: it needs the point's x, y and size, which the scatter hands it",
    );
  const row = (props.datum ?? {}) as Row;
  const raw = row[props.team] as Value;
  if (raw === undefined || raw === null) {
    warn(
      `victory:LogoPoint:no-team:${props.team}`,
      `LogoPoint: a datum has no ${props.team} field: nothing drawn`,
    );
    return null;
  }
  const p = size > 0 ? placed(x, y, raw, [row], props) : undefined;
  if (p === undefined) return null; // no mark: nothing drawn, one warning (placeSync), as sdvplot/echarts
  const h = 2 * size;
  const w = h * aspect(p);
  return image(
    p,
    props,
    raw,
    { left: x - w / 2, top: y - h / 2, h },
    { x, y },
    { ...props.events, ...(alpha === 1 ? {} : { opacity: alpha }) },
  );
}

// victory loads only to draw a tick label as text (a team with no logo), never with sdvplot/react.
const Label = lazy(async (): Promise<{ default: ComponentType<Record<string, unknown>> }> => {
  const m = await import("victory").catch((e: unknown) => {
    throw new OptionalDependencyError(
      "LogoTick needs the optional peer victory to draw a label as text, and it could not be loaded: pnpm add victory",
      { cause: e },
    );
  });
  return { default: m.VictoryLabel as ComponentType<Record<string, unknown>> };
});

/**
 * Team logos as an axis' tick labels: `<VictoryAxis tickLabelComponent={<LogoTick league />} />` on an axis whose
 * labels are teams. The logo sits where the label would, on the side of Victory's anchor the label would run (under
 * a bottom axis, left of a left one), `size` px tall. A label that resolves to no logo keeps its text, drawn by
 * Victory's own `VictoryLabel` (loaded from victory when it first draws one; it then also warns once), as
 * `sdvplot/echarts`' `withAxisLogos` does. Synchronous: call it after `loadLeague(league)`.
 *
 * @example
 * ```tsx
 * import { loadLeague } from "@sportsdataverse/sdvplot";
 * import { LogoTick } from "@sportsdataverse/sdvplot/react";
 * import { VictoryAxis, VictoryBar, VictoryChart } from "victory";
 *
 * await loadLeague("nfl");
 * const rows = [
 *   { team: "KC", wins: 15 },
 *   { team: "BUF", wins: 13 },
 *   { team: "LAC", wins: 11 },
 * ];
 * <VictoryChart domainPadding={40} padding={{ top: 20, bottom: 60, left: 50, right: 20 }}>
 *   <VictoryAxis tickLabelComponent={<LogoTick league="nfl" size={32} />} />
 *   <VictoryAxis dependentAxis />
 *   <VictoryBar data={rows} x="team" y="wins" />
 * </VictoryChart>;
 * ```
 */
export function LogoTick(props: LogoTickProps): ReactElement {
  if ("height" in props)
    throw new InputError(
      "LogoTick takes no height: size is the logo's height in px (Victory hands a tick label no plot height)",
    );
  const h = checkSize(props.size ?? 24);
  const { league, season, variant, idSystem, markType, embed, size, ...label } = props;
  const x = isNum(props.x) ? props.x : 0;
  const y = isNum(props.y) ? props.y : 0;
  const raw = typeof props.text === "string" || typeof props.text === "number" ? props.text : undefined;
  const p = raw === undefined ? undefined : placed(x, y, raw, [], props);
  if (p === undefined)
    return (
      <Suspense fallback={null}>
        <Label {...label} />
      </Suspense>
    );
  const w = h * aspect(p);
  const anchor = props.textAnchor ?? "start";
  const vertical = props.verticalAnchor ?? "middle";
  const left = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
  const top = vertical === "end" ? y - h : vertical === "middle" ? y - h / 2 : y;
  return image(p, props, raw as Value, { left, top, h }, { x, y }, {});
}
