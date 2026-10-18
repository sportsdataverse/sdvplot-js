import { NFL_TEAM_EPA_2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { withLogos } from "@sportsdataverse/sdvplot/vega";
import * as vega from "vega";
import { type TopLevelSpec, compile } from "vega-lite";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Vega-Lite: all 32 teams' 2024 offensive and defensive EPA per play, as logos (an SVG in Node)",
  tags: ["node", "vega", "withLogos", "epa", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const rows = NFL_TEAM_EPA_2024.map((t) => ({
  team: t.team,
  off: t.off_epa / t.off_plays,
  def: t.def_epa / t.def_plays,
}));
const chart: TopLevelSpec = {
  width: 520,
  height: 420,
  data: { values: rows },
  layer: [
    // a hairline at zero on each axis: an average offence and an average defence
    { mark: { type: "rule", color: "#999" }, encoding: { x: { datum: 0, type: "quantitative" } } },
    { mark: { type: "rule", color: "#999" }, encoding: { y: { datum: 0, type: "quantitative" } } },
    {
      // the hover target: sdvplot's logo layer never shows a tooltip, so a transparent point under each logo does
      mark: { type: "point", opacity: 0, size: 500 },
      encoding: {
        x: {
          field: "off",
          type: "quantitative",
          title: "Offensive EPA per play",
          scale: { domain: [-0.22, 0.22] },
        },
        // reversed: a good defence allows negative EPA, so the best teams sit top right
        y: {
          field: "def",
          type: "quantitative",
          title: "Defensive EPA per play allowed",
          scale: { domain: [-0.12, 0.17], reverse: true },
        },
        tooltip: [{ field: "team" }, { field: "off", format: ".3f" }, { field: "def", format: ".3f" }],
      },
    },
  ],
};
// withLogos adds its image layer to the layered spec; it reads the x and y encodings, reversed scale and all.
const spec = withLogos(chart, rows, { league: "nfl", x: "off", y: "def", team: "team", height: 0.07 });

// In the browser: vegaEmbed(div, spec, { renderer: "svg" }), as this page does (the SVG names each mark, "KC logo").
export const browser = { lib: "vega", spec } as const;

const view = new vega.View(vega.parse(compile(browser.spec).spec), { renderer: "none" });
export default await view.toSVG();
