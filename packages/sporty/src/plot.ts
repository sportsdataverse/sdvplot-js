import * as Plot from "@observablehq/plot";
import {
  type PolygonFeature,
  type Scene,
  type TextFeature,
  hidden,
  isVisiblePolygon,
  isVisibleText,
} from "./scene.js";

export { isVisiblePolygon }; // re-exported so existing importers keep working

export const SPORTY_PLOT_SUBPATH = "@sportsdataverse/sporty/plot";

export interface SurfaceFeatureProps {
  name: string;
  zIndex: number;
  fill: string;
  stroke: string | null;
}
interface PolygonGeometry {
  type: "Polygon";
  coordinates: [number, number][][];
}
interface GeoFeature {
  type: "Feature";
  properties: SurfaceFeatureProps;
  geometry: PolygonGeometry;
}
export interface SurfaceFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

/**
 * Polygons as a GeoJSON FeatureCollection in zIndex order. Applies the same skips as `toSVG`
 * (see {@link isVisiblePolygon}); a hidden fill with a stroke is kept (fill reads as transparent).
 */
export function sceneToGeoJSON(scene: Scene): SurfaceFeatureCollection {
  const polys = scene.features
    .filter((f): f is PolygonFeature => f.kind === "polygon" && isVisiblePolygon(f))
    .sort((a, b) => a.zIndex - b.zIndex);
  return {
    type: "FeatureCollection",
    features: polys.map((f) => {
      const ring = f.points.map(([x, y]) => [x, y] as [number, number]);
      const [fx, fy] = ring[0] ?? [0, 0];
      const [lx, ly] = ring[ring.length - 1] ?? [0, 0];
      if (fx !== lx || fy !== ly) ring.push([fx, fy]); // GeoJSON rings close explicitly
      return {
        type: "Feature",
        properties: { name: f.name, zIndex: f.zIndex, fill: f.fill, stroke: f.stroke ?? null },
        geometry: { type: "Polygon", coordinates: [ring] },
      };
    }),
  };
}

/**
 * Plot marks for a Scene, drawn through the plot's x/y scales (no projection): optional background,
 * polygons, then text. Text font size = number height (`fitBox[1] / 1.5`) mapped through the y scale
 * unless `textFontSize` overrides it.
 */
export function surfaceMark(scene: Scene, o: { textFontSize?: number } = {}): Plot.Markish[] {
  const [x0, y0, x1, y1] = scene.bbox;
  const texts = scene.features
    .filter((f): f is TextFeature => f.kind === "text" && isVisibleText(f))
    .sort((a, b) => a.zIndex - b.zIndex);
  const marks: Plot.Markish[] = [];
  if (scene.background !== undefined) {
    const ring: [number, number][] = [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
      [x0, y0],
    ];
    const bgFeature: GeoFeature = {
      type: "Feature",
      properties: { name: "background", zIndex: -1, fill: scene.background, stroke: null },
      geometry: { type: "Polygon", coordinates: [ring] },
    };
    marks.push(
      Plot.geo({ type: "FeatureCollection", features: [bgFeature] } as SurfaceFeatureCollection, {
        fill: scene.background,
      }),
    );
  }
  // No plot-level projection => Plot.geo maps coordinates through the x and y scales.
  marks.push(
    Plot.geo(sceneToGeoJSON(scene), {
      fill: (f: GeoFeature) => (hidden(f.properties.fill) ? "none" : f.properties.fill),
      stroke: (f: GeoFeature) => f.properties.stroke ?? "none",
    }),
  );
  if (texts.length) {
    const textMark = Plot.text(texts, {
      x: "x",
      y: "y",
      text: "text",
      fill: "fill",
      rotate: (f: TextFeature) => -f.rotation, // sporty CCW-positive; Plot clockwise
      textAnchor: "middle",
      render(index, scales, values, dimensions, context, next) {
        const g = next?.(index, scales, values, dimensions, context) as SVGElement | null | undefined;
        if (g == null) return null;
        const y = scales.y as (v: number) => number;
        const els = g.querySelectorAll("text");
        index.forEach((i, k) => {
          const f = texts[i];
          const el = els[k];
          if (f === undefined || el === undefined) return;
          el.setAttribute("font-size", String(o.textFontSize ?? Math.abs(y(f.fitBox[1] / 1.5) - y(0))));
          el.setAttribute("font-family", f.fontFamily);
        });
        return g;
      },
    });
    marks.push(textMark);
  }
  return marks;
}

export function surfaceScales(scene: Scene): {
  x: { domain: [number, number]; axis: null };
  y: { domain: [number, number]; axis: null };
  aspectRatio: 1;
} {
  const [x0, y0, x1, y1] = scene.bbox;
  return { x: { domain: [x0, x1], axis: null }, y: { domain: [y0, y1], axis: null }, aspectRatio: 1 };
}
