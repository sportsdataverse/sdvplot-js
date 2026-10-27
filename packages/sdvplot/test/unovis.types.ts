import type {
  ColorAccessor,
  GraphConfigInterface,
  SankeyConfigInterface,
  SingleContainerConfigInterface,
  StringAccessor,
} from "@unovis/ts";
import { expectTypeOf, test } from "vitest";
import { type UnovisIcons, type UnovisTeamColorScale, logoIcons, teamColorScale } from "../src/unovis.js";

type N = { id: string; team: number | string };
type L = { source: string; target: string; team: number | string; value: number };

test("the sdvplot pieces fit Unovis 1.7's own accessor and container types", () => {
  const color = teamColorScale("nfl", [12, "PHI"]);
  const logos = logoIcons("nfl", [12, "PHI"]);
  expectTypeOf(color).toMatchTypeOf<UnovisTeamColorScale<number | string>>();
  expectTypeOf(logos).toMatchTypeOf<UnovisIcons<number | string>>();
  // a colour accessor and an icon accessor, as the docs write them
  expectTypeOf((n: N) => color(n.team)).toMatchTypeOf<ColorAccessor<N>>();
  expectTypeOf((n: N) => logos(n.team)).toMatchTypeOf<StringAccessor<N>>();
  expectTypeOf({
    nodeFill: (n: N) => color(n.team),
    nodeIcon: (n: N) => logos(n.team),
    linkStroke: (l: L) => color(l.team),
  }).toMatchTypeOf<Partial<GraphConfigInterface<N, L>>>();
  expectTypeOf({ linkColor: (l: L) => color(l.team) }).toMatchTypeOf<Partial<SankeyConfigInterface<N, L>>>();
  expectTypeOf({ svgDefs: logos.svgDefs }).toMatchTypeOf<Partial<SingleContainerConfigInterface<unknown>>>();
  // the palette list is an XY component's `color`
  expectTypeOf(color.range).toMatchTypeOf<readonly string[]>();
});
