import { nflPlays2024 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { teamColorPalette } from "@sportsdataverse/sdvplot/recharts";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Mosaic (experimental): brush an EPA histogram of 11,778 plays and the team-coloured bars and the table follow, queried by DuckDB-WASM in the page",
  tags: ["mosaic", "vgplot", "duckdb", "linked views", "crossfilter", "play-by-play", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
// nflverse's 2024 play-by-play, weeks 1 to 6: the same rows go to DuckDB in the browser and to the static copy below
const plays = await nflPlays2024();
const teams = [...new Set(plays.map((p) => p.posteam))].sort();
// sdvplot's shared team palette, on the views' white background: every colour reads at 3:1 and stays apart
const colors = teamColorPalette("nfl", teams, { background: "#ffffff" });

// In the browser this page calls mount with vgplot (Mosaic's coordinator already connected to DuckDB-WASM) and the
// database itself.
export const browser = {
  lib: "mosaic",
  mount: async ({
    vg,
    db,
  }: { vg: typeof import("@uwdata/vgplot"); db: import("@duckdb/duckdb-wasm").AsyncDuckDB }) => {
    // the plays as a DuckDB table. CSV, read by DuckDB's core reader: read_parquet would first fetch DuckDB's Parquet
    // extension from extensions.duckdb.org (see the guide), and this page asks nothing of any other site.
    const columns = ["play", "posteam", "defteam", "play_type", "yards_gained", "epa"] as const;
    const csv = [columns.join(","), ...plays.map((p) => columns.map((c) => p[c] ?? "").join(","))].join("\n");
    await db.registerFileText("plays.csv", csv);
    await vg.coordinator().exec(vg.loadCSV("plays", "plays.csv", { replace: true }));
    // what the histogram's brush selects filters the other two views
    const brush = vg.Selection.intersect();
    const view = vg.vconcat(
      vg.plot(
        vg.rectY(vg.from("plays"), {
          x: vg.bin("epa", { steps: 60 }),
          y: vg.count(),
          fill: "#6b7280",
          inset: 0.5,
        }),
        vg.intervalX({ as: brush }),
        vg.xLabel("EPA per play (drag to brush)"),
        vg.yLabel("Plays"),
        vg.width(680),
        vg.height(170),
      ),
      vg.plot(
        vg.barX(vg.from("plays", { filterBy: brush }), {
          x: vg.count(),
          y: "posteam",
          fill: "posteam",
          sort: { y: "-x" },
        }),
        vg.colorDomain(teams),
        vg.colorRange(colors),
        vg.xLabel("Plays in the brush"),
        vg.yLabel(null),
        vg.width(680),
        vg.height(560),
        vg.marginLeft(48),
      ),
      vg.table({
        from: "plays",
        filterBy: brush,
        columns: [...columns],
        width: 680,
        height: 240,
      }),
    );
    Object.assign(view.style, { background: "#ffffff", color: "#111827", padding: "8px" });
    return { view, brush };
  },
  width: 700,
  label:
    "Three linked views of the 11,778 rush and pass plays of weeks 1 to 6 of the 2024 NFL season: an EPA histogram to brush, plays per offence as team-coloured bars, and the plays in a table",
} as const;

// Mosaic draws only in a browser (DuckDB-WASM runs there); without JavaScript the page shows what the bars start at
export default {
  plays: plays.length,
  playsByOffence: Object.fromEntries(teams.map((t) => [t, plays.filter((p) => p.posteam === t).length])),
};
