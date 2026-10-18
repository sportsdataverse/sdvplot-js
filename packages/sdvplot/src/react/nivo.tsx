import { type ComponentType, type ReactElement, Suspense, createElement, lazy, useMemo } from "react";
import { OptionalDependencyError } from "../errors.js";
import { type NivoLayerOptions, logoLayer, teamColors } from "../nivo.js";
import type { IdSystem, League, MarkType, SeasonInput, Variant } from "../types.js";

/**
 * `<LogoBump>` props: the series, the league their ids belong to, and how to draw the logos; every other prop goes to
 * nivo's `Bump` as is (typed loosely, so `sdvplot/react`'s types never name `@nivo/bump`, an optional peer).
 */
export interface LogoBumpProps {
  /** nivo Bump series, `{ id, data: [{ x, y }] }`: each `id` is a team (abbreviation, name or id). */
  data: readonly {
    readonly id: string;
    readonly data: readonly { x: number | string; y: number | null }[];
  }[];
  /** The league the series' teams belong to, e.g. "nfl". */
  league: League;
  /** The season the teams are resolved for. */
  season?: SeasonInput;
  /** How the series' ids are read. Default "auto". */
  idSystem?: IdSystem;
  /** The chart's background: the line colours keep 3:1 contrast against it and stay distinct (`teamColors`). */
  background?: string;
  /** Logo height as a fraction of the plot height, in (0, 1]. Default 0.08. */
  logoHeight?: number;
  /** Which points get a logo: "last" (default), "first" or "all". */
  at?: NivoLayerOptions["at"];
  /** Logo variant, e.g. "dark". Default "default". */
  variant?: Variant;
  /** "logo" (default) or "wordmark". */
  markType?: MarkType;
  /** Width and height in px. Both given: a fixed-size `Bump`; otherwise a `ResponsiveBump` that fills its parent. */
  width?: number;
  /** Chart height in px (see `width`). */
  height?: number;
  /** nivo's layers, the logos added on top. Default nivo's own (grid, axes, labels, lines, points, then the logos, then mesh). */
  layers?: readonly unknown[];
  /** Any other nivo `Bump` prop (margin, axes, pointSize, animate, theme, ...). */
  [prop: string]: unknown;
}

const LAYERS = ["grid", "axes", "labels", "lines", "points"]; // then the logos, then nivo's "mesh" (mouse) on top

// @nivo/bump loads on first render, never with sdvplot/react: a page that draws no LogoBump needs no nivo.
const Chart = lazy(async (): Promise<{ default: ComponentType<Record<string, unknown>> }> => {
  const m = await import("@nivo/bump").catch((e: unknown) => {
    throw new OptionalDependencyError(
      "LogoBump needs the optional peer @nivo/bump, which could not be loaded: pnpm add @nivo/bump @nivo/core",
      { cause: e },
    );
  });
  const Drawn = (p: Record<string, unknown>): ReactElement =>
    createElement(
      (p.width === undefined || p.height === undefined ? m.ResponsiveBump : m.Bump) as ComponentType<
        Record<string, unknown>
      >,
      p,
    );
  return { default: Drawn };
});

/**
 * A nivo bump chart of teams: each line in its team's colour (`teamColors`), a logo at the end of each line
 * (`logoLayer`). `@nivo/bump` (0.99 or later) loads when it first renders, never with `sdvplot/react`; missing, it
 * throws `OptionalDependencyError` then. A server render draws nothing (it loads on the client). For anything this
 * does not cover, use `teamColors` and `logoLayer` from `sdvplot/nivo` on nivo's own `Bump`.
 */
export function LogoBump({
  league,
  season,
  idSystem,
  background,
  logoHeight,
  at,
  variant,
  markType,
  layers,
  ...rest
}: LogoBumpProps): ReactElement {
  const teams = rest.data.map((s) => s.id);
  const key = JSON.stringify([
    league,
    season,
    idSystem,
    background,
    logoHeight,
    at,
    variant,
    markType,
    teams,
  ]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the options by value
  const drawn = useMemo(() => {
    const o = {
      league,
      ...(season === undefined ? {} : { season }),
      ...(idSystem === undefined ? {} : { idSystem }),
    };
    return {
      colors: teamColors({ ...o, ...(background === undefined ? {} : { teams, background }) }),
      logos: logoLayer({
        ...o,
        ...(logoHeight === undefined ? {} : { height: logoHeight }),
        ...(at === undefined ? {} : { at }),
        ...(variant === undefined ? {} : { variant }),
        ...(markType === undefined ? {} : { markType }),
      }),
    };
  }, [key]);
  return (
    <Suspense fallback={null}>
      <Chart
        colors={drawn.colors}
        {...rest}
        layers={layers === undefined ? [...LAYERS, drawn.logos, "mesh"] : [...layers, drawn.logos]}
      />
    </Suspense>
  );
}
