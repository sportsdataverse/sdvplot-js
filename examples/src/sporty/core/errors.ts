import { createCanvas } from "@napi-rs/canvas";
import {
  InputError,
  SportyError,
  UnknownDisplayRangeError,
  UnknownLeagueError,
  UnknownUnitError,
  normalizeUnit,
  surface,
} from "@sportsdataverse/sporty";
import { drawScene } from "@sportsdataverse/sporty/canvas";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Errors: one class per mistake, all SportyError",
  tags: [
    "node",
    "errors",
    "SportyError",
    "UnknownLeagueError",
    "UnknownDisplayRangeError",
    "UnknownUnitError",
    "InputError",
  ],
} satisfies ExampleMeta;

const caught = (f: () => unknown) => {
  try {
    f();
    return "no error";
  } catch (e) {
    if (!(e instanceof SportyError)) throw e;
    return {
      name: e.name,
      "instanceof SportyError": e instanceof SportyError,
      "instanceof UnknownLeagueError": e instanceof UnknownLeagueError,
      "instanceof UnknownDisplayRangeError": e instanceof UnknownDisplayRangeError,
      "instanceof UnknownUnitError": e instanceof UnknownUnitError,
      "instanceof InputError": e instanceof InputError,
      message: e.message.length > 110 ? `${e.message.slice(0, 110)}…` : e.message,
    };
  }
};

// A league name is any string at compile time (new leagues need no release), so a typo surfaces here.
export default {
  'surface("hockey", "khl")': caught(() => surface("hockey", "khl")),
  'surface("hockey", "nhl", { displayRange: "slot" })': caught(() =>
    // @ts-expect-error: the display range is checked at compile time too
    surface("hockey", "nhl", { displayRange: "slot" }),
  ),
  'normalizeUnit("furlong")': caught(() => normalizeUnit("furlong")),
  'surface("soccer", "epl", { arcResolution: 1 })': caught(() =>
    surface("soccer", "epl", { arcResolution: 1 }),
  ),
  // nothing to draw: the xlim crops the pitch to zero width (here on an @napi-rs/canvas context, in Node)
  'drawScene(ctx, surface("soccer", "epl", { xlim: [0, 0] }))': caught(() =>
    drawScene(createCanvas(100, 100).getContext("2d"), surface("soccer", "epl", { xlim: [0, 0] })),
  ),
};
