import * as Plot from "@observablehq/plot";
import { InputError } from "../errors.js";
import type { Channel, Data } from "./marks.js";

export interface RefLineOptions<R> {
  x?: Channel<R>;
  y?: Channel<R>;
  /** Default "red". */
  stroke?: string;
  /** Default "4 4". */
  strokeDasharray?: string;
  /** Default 1. */
  strokeWidth?: number;
  strokeOpacity?: number;
}

function refLines<R>(data: Data<R>, o: RefLineOptions<R>, reducer: "mean" | "median"): Plot.Markish[] {
  if (o.x === undefined && o.y === undefined)
    throw new InputError(`${reducer}Lines() needs an x and/or a y channel`);
  const style = {
    stroke: o.stroke ?? "red",
    strokeDasharray: o.strokeDasharray ?? "4 4",
    strokeWidth: o.strokeWidth ?? 1,
    ...(o.strokeOpacity !== undefined ? { strokeOpacity: o.strokeOpacity } : {}),
  };
  const d = data as Plot.Data;
  const marks: Plot.Markish[] = [];
  // groupZ reduces per facet
  if (o.x !== undefined)
    marks.push(Plot.ruleX(d, Plot.groupZ({ x: reducer }, { x: o.x as Plot.ChannelValue, ...style })));
  if (o.y !== undefined)
    marks.push(Plot.ruleY(d, Plot.groupZ({ y: reducer }, { y: o.y as Plot.ChannelValue, ...style })));
  return marks;
}

/** A vertical rule at mean(x) and/or a horizontal rule at mean(y), per facet. Throws InputError if neither is given. */
export function meanLines<R>(data: Data<R>, o: RefLineOptions<R>): Plot.Markish[] {
  return refLines(data, o, "mean");
}
/** Like `meanLines`, at the median. */
export function medianLines<R>(data: Data<R>, o: RefLineOptions<R>): Plot.Markish[] {
  return refLines(data, o, "median");
}
