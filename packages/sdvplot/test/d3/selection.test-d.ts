// Every exported d3 helper takes a selection whatever its datum (S21). d3's Selection is invariant in Datum, so a
// helper typed `Selection<…, unknown, null, undefined>` rejects `create("svg").append("g")` (datum undefined), a
// bound datum and a data join. tsc (the package typecheck) and vitest's typecheck both compile this file.
import { create, select } from "d3";
import { test } from "vitest";
import {
  appendHeadshots,
  appendLegend,
  appendLogos,
  appendSignature,
  appendSurface,
  appendWordmarks,
} from "../../src/d3/index.js";

const at = { x: (v: unknown) => Number(v), y: (v: unknown) => Number(v), frameHeight: 100 };
const xy = { x: (d: number) => d, y: (d: number) => d };

test("create(), select(div), a bound datum and a data join pass to every d3 helper", () => {
  const div = document.createElement("div");
  const created = create("svg").append("g"); // Selection<SVGGElement, undefined, null, undefined>
  const selected = select(div).append("svg").append("g"); // Selection<SVGGElement, unknown, null, undefined>
  const bound = select(div).datum({ team: "BKN" }).append("svg").append("g"); // datum { team: string }
  const joined = select(div).append("svg").selectAll<SVGGElement, number>("g").data([1, 2]).join("g"); // datum number, parent svg

  appendLegend(created);
  appendLegend(selected);
  appendLegend(bound);
  appendLegend(joined);
  appendSignature(created, [], xy);
  appendSignature(selected, [], xy);
  appendSignature(bound, [], xy);
  appendSignature(joined, [], xy);
  appendLogos(created, [1], [1], ["BKN"], { league: "nba", ...at });
  appendLogos(selected, [1], [1], ["BKN"], { league: "nba", ...at });
  appendLogos(bound, [1], [1], ["BKN"], { league: "nba", ...at });
  appendLogos(joined, [1], [1], ["BKN"], { league: "nba", ...at });
  appendWordmarks(created, [1], [1], ["BKN"], { league: "nba", ...at });
  appendWordmarks(selected, [1], [1], ["BKN"], { league: "nba", ...at });
  appendWordmarks(bound, [1], [1], ["BKN"], { league: "nba", ...at });
  appendWordmarks(joined, [1], [1], ["BKN"], { league: "nba", ...at });
  appendHeadshots(created, [1], [1], ["3139477"], { league: "nba", ...at });
  appendHeadshots(selected, [1], [1], ["3139477"], { league: "nba", ...at });
  appendHeadshots(bound, [1], [1], ["3139477"], { league: "nba", ...at });
  appendHeadshots(joined, [1], [1], ["3139477"], { league: "nba", ...at });
  appendSurface(created, "nba", xy);
  appendSurface(selected, "nba", xy);
  appendSurface(bound, "nba", xy);
  appendSurface(joined, "nba", xy);
  // the <svg> itself, for the helpers that take one
  appendLogos(create("svg"), [1], [1], ["BKN"], { league: "nba", ...at });
  appendHeadshots(create("svg"), [1], [1], ["3139477"], { league: "nba", ...at });
  appendSurface(create("svg"), "nba", xy);
  appendSurface(select(div).datum(7).append("svg"), "nba", xy);
});
