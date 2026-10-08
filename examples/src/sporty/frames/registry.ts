import { FRAMES } from "@sportsdataverse/sporty";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "The built-in frames",
  tags: ["frames", "FRAMES"],
} satisfies ExampleMeta;

// Pass a name as `toSurfaceFrame(rows, { from: name })`. Frames move the DATA onto the surface; the surface
// options xTrans/yTrans move the SURFACE.
export default Object.fromEntries(Object.entries(FRAMES).map(([name, f]) => [name, f.description]));
