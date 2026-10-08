/** Structural types for a Vega-Lite spec: the subset `sdvplot/vega` reads and writes. No runtime import of vega-lite. */
export type VegaLiteSpec = Record<string, unknown> & {
  layer?: unknown[];
  encoding?: Record<string, unknown>;
  mark?: unknown;
  width?: unknown;
  height?: unknown;
  config?: Record<string, unknown>;
  data?: unknown;
  datasets?: Record<string, unknown>;
};
export interface ImageLayer {
  name: string;
  data: { values: Record<string, unknown>[] };
  mark: {
    type: "image";
    width: number;
    height: number;
    aspect: true;
    opacity?: number;
    align?: "left" | "center" | "right";
    baseline?: "top" | "middle" | "bottom";
  };
  encoding: Record<string, unknown>;
}
