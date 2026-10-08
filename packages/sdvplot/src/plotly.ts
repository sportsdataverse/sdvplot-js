/** Structural types for a plotly.js figure: the subset `sdvplot/plotly` reads and writes. No runtime import of plotly.js. */
export interface PlotlyAxis {
  type?: "-" | "linear" | "log" | "date" | "category";
  range?: readonly [unknown, unknown];
  autorange?: boolean | "reversed";
  categoryorder?: string;
  categoryarray?: readonly unknown[];
  domain?: readonly [number, number];
  tickmode?: string;
  tickvals?: readonly unknown[];
  ticktext?: readonly string[];
}
export interface LayoutImage {
  source: string;
  xref: string;
  yref: string;
  x: number;
  y: number;
  sizex: number;
  sizey: number;
  sizing: "contain" | "fill" | "stretch";
  xanchor: "left" | "center" | "right";
  yanchor: "top" | "middle" | "bottom";
  opacity?: number;
  layer?: "above" | "below";
  name?: string;
}
// A18: an index-signature pattern may not contain a literal (TS1337), so `xaxis`/`yaxis` are declared and the pattern
// covers the numbered axes only.
export interface PlotlyLayout {
  width?: number;
  height?: number;
  margin?: { l?: number; r?: number; t?: number; b?: number };
  barmode?: string;
  barnorm?: string;
  images?: readonly LayoutImage[];
  xaxis?: PlotlyAxis;
  yaxis?: PlotlyAxis;
  [axis: `${"x" | "y"}axis${number}`]: PlotlyAxis | undefined;
}
export interface PlotlyTrace {
  type?: string;
  x?: readonly unknown[];
  y?: readonly unknown[];
  x0?: number;
  y0?: number;
  dx?: number;
  dy?: number;
  xaxis?: string;
  yaxis?: string;
  orientation?: "v" | "h";
  base?: unknown;
  offsetgroup?: string;
  stackgroup?: string;
  fill?: string;
}
export interface PlotlyFigure {
  data: readonly PlotlyTrace[];
  layout?: PlotlyLayout;
}
