import * as Plot from "@observablehq/plot";
import { surface } from "@sportsdataverse/sporty";
import { sceneToGeoJSON, surfaceScales } from "@sportsdataverse/sporty/plot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "A surface as GeoJSON, drawn with Plot.geo",
  tags: ["plot", "sceneToGeoJSON", "geo", "rotation", "curling", "wcf"],
} satisfies ExampleMeta;

// sceneToGeoJSON gives one GeoJSON polygon per feature (name, fill, stroke in `properties`), for any tool that
// reads GeoJSON. Here Plot.geo draws it with no projection, so x/y are feet; colour by feature name instead.
// A sheet is long and narrow, so rotation 90 lays it across the page.
const sheet = surface("curling", "wcf", { rotation: 90 });
const geo = sceneToGeoJSON(sheet);

export default Plot.plot({
  ...surfaceScales(sheet),
  width: 760,
  color: { legend: true },
  marks: [Plot.geo(geo, { fill: (f) => f.properties.name, stroke: "black", strokeWidth: 0.5 })],
});
