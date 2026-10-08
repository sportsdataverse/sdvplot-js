/** Structural types for an ECharts option: the subset `sdvplot/echarts` reads and writes. No runtime import of echarts. */
export interface EChartsAxis {
  type?: "value" | "category" | "time" | "log";
  data?: readonly unknown[];
  axisLabel?: Record<string, unknown>;
}
// A20: an interface is not a Record<string, unknown>, so the series list names LogoSeries explicitly.
export interface EChartsOption {
  xAxis?: EChartsAxis | readonly EChartsAxis[];
  yAxis?: EChartsAxis | readonly EChartsAxis[];
  series?: readonly (Record<string, unknown> | LogoSeries)[];
  color?: readonly string[];
  grid?: Record<string, unknown>;
}
export interface LogoSeries {
  id: string;
  name: string;
  type: "custom";
  coordinateSystem: "cartesian2d";
  xAxisIndex?: number;
  yAxisIndex?: number;
  data: (string | number)[][];
  encode: { x: number; y: number };
  z: number;
  silent: true;
  renderItem: (params: RenderParams, api: RenderApi) => RenderedImage;
}
/** echarts types `coordSys` as `{ type: string }`; a cartesian2d series gets x, y, width and height at run time. */
export interface RenderParams {
  coordSys: { type?: string; x?: number; y?: number; width?: number; height?: number };
} // A20
export interface RenderApi {
  value: (dim: number) => number | string;
  coord: (data: (number | string)[]) => number[];
}
export interface RenderedImage {
  type: "image";
  style: { image: string; x: number; y: number; width: number; height: number; opacity?: number };
}
