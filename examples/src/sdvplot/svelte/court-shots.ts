import { NBA_SHOTS } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { surface, toSurfaceFrame } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Svelte + LayerChart: LAL at DEN's fourth-quarter shots over a Nuggets-painted court",
  tags: ["svelte", "layerchart", "SurfaceBackdrop", "teamColorPalette", "surface", "nba"],
} satisfies ExampleMeta;

await loadLeague("nba");
// stats.nba.com shots (x_legacy/y_legacy, tenths of a foot from the hoop), in court feet.
const shots = toSurfaceFrame(NBA_SHOTS, { from: "nba-legacy" }).map((s) => ({
  x: Number(s.surface_x),
  y: Number(s.surface_y),
  team: s.team,
  made: s.made,
}));
// the chart's domains are the surface's bbox, so the court fills the plot area and one foot is one foot both ways
const bbox = surface("basketball", "nba", { displayRange: "defense" }).bbox;
const width = 480;
const height = Math.round((width * (bbox[3] - bbox[1])) / (bbox[2] - bbox[0]));

// In the browser: examples/snippets/svelte/CourtShots.svelte, mounted with these props (Svelte's mount()).
export const browser = {
  lib: "svelte",
  component: "CourtShots",
  props: { shots, bbox, width, height },
  label:
    "The Lakers' and the Nuggets' 38 fourth-quarter shots of 24 October 2023 on Denver's defensive half court, makes filled and misses ringed in each team's colour",
} as const;

// Svelte draws only in a browser here; without JavaScript the page shows each team's makes and attempts.
export default ["LAL", "DEN"].map((team) => ({
  team,
  made: shots.filter((s) => s.team === team && s.made).length,
  attempts: shots.filter((s) => s.team === team).length,
}));
