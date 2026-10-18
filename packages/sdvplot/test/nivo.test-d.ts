import type { BumpCommonProps, BumpDatum, BumpLayer, BumpPointComponent } from "@nivo/bump";
import type { CustomLayer as ChordLayer } from "@nivo/chord";
import type { CircleComponent, SwarmPlotCommonProps, SwarmPlotLayer } from "@nivo/swarmplot";
import { expectTypeOf, test } from "vitest";
import { logoLayer, logoNode, teamColors } from "../src/nivo.js";

type Row = { team: string; pf: number; group: string };
type Extra = Record<string, unknown>;

test("the structural types accept what nivo 0.99 hands them", () => {
  const layer = logoLayer({ league: "nfl" });
  expectTypeOf(layer).toMatchTypeOf<BumpLayer<BumpDatum, Extra>>();
  expectTypeOf(layer).toMatchTypeOf<SwarmPlotLayer<Row>>();
  expectTypeOf(layer).toMatchTypeOf<ChordLayer>();
  const node = logoNode({ league: "nfl" });
  expectTypeOf(node).toMatchTypeOf<CircleComponent<Row>>();
  expectTypeOf(node).toMatchTypeOf<BumpPointComponent<BumpDatum, Extra>>();
  const colors = teamColors({ league: "nfl" });
  expectTypeOf(colors).toMatchTypeOf<BumpCommonProps<BumpDatum, Extra>["colors"]>();
  expectTypeOf(colors).toMatchTypeOf<SwarmPlotCommonProps<Row>["colors"]>();
});
