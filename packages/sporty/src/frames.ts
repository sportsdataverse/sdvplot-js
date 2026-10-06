/** A data row: column name to value. */
export type Row = Record<string, unknown>;

/**
 * A source coordinate frame: maps a data row to surface feet. The functions receive a two-key view
 * `{ x, y }` holding the caller's chosen input columns (see {@link toSurfaceFrame}), not the full row.
 * Return `null` for a missing coordinate, never `NaN`.
 */
export interface Frame {
  x: (r: Row) => number | null;
  y: (r: Row) => number | null;
  description: string;
}

/** `null`/`undefined`/`NaN` to null; numbers as-is; numeric strings parsed (blank gives null); anything else gives null. */
const num = (v: unknown): number | null => {
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return null;
    return Number.isNaN(Number(s)) ? null : Number(s);
  }
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
};

/** Centre-origin `w`x`h` pixel canvas (y down) onto a 200x85 ft rink (y up). */
const canvasX = (v: unknown, w: number): number | null => {
  const x = num(v);
  return x === null ? null : ((x - w / 2) * 200) / w;
};
const canvasY = (v: unknown, h: number): number | null => {
  const y = num(v);
  return y === null ? null : ((h / 2 - y) * 85) / h;
};

/**
 * Registry of source frames. sporty's `xTrans`/`yTrans` move the SURFACE; these move the DATA into the
 * surface frame (feet, surface origin).
 */
export const FRAMES: {
  /**
   * stats.nba.com legacy shots. The hoop lands at `x = -41.75`, so every shot is on the -x half: pair it with
   * `displayRange: "defense"` (as sdvplot's `court_coords` documents).
   */
  readonly "nba-legacy": Frame;
  readonly "hockeytech-a": Frame;
  readonly "hockeytech-b": Frame;
  readonly "espn-football-0-100": Frame;
} = {
  "nba-legacy": {
    x: (r: Row): number | null => {
      const y = num(r.y);
      return y === null ? null : -47 + 5.25 + y / 10;
    },
    y: (r: Row): number | null => {
      const x = num(r.x);
      return x === null ? null : x / 10;
    },
    description:
      "stats.nba.com shot frame: tenths of a foot, hoop origin, x across the court (sdvplot court_coords; input columns default to x_legacy/y_legacy)",
  },
  "hockeytech-a": {
    x: (r: Row): number | null => canvasX(r.x, 850),
    y: (r: Row): number | null => canvasY(r.y, 400),
    description:
      "HockeyTech 850x400 canvas, top-left origin -> 200x85 ft centre origin (generalises fastRhockey's 600x300 transform)",
  },
  "hockeytech-b": {
    x: (r: Row): number | null => canvasX(r.x, 600),
    y: (r: Row): number | null => canvasY(r.y, 300),
    description:
      "HockeyTech 600x300 canvas, top-left origin -> 200x85 ft centre origin (fastRhockey hockeytech_analytics: x/3-100, 42.5-y*85/300)",
  },
  "espn-football-0-100": {
    x: (r: Row): number | null => {
      const x = num(r.x);
      return x === null ? null : x - 50;
    },
    y: (r: Row): number | null => num(r.y),
    description: "ESPN football: x is a 0-100 yardline -> -50..50 along x; y passes through (yards)",
  },
};

export type FrameName = keyof typeof FRAMES;

/** Origin bottom-left corner of a `length` x `width` surface to centre origin. */
export function frameBottomLeft(length: number, width: number): Frame {
  return {
    x: (r) => {
      const x = num(r.x);
      return x === null ? null : x - length / 2;
    },
    y: (r) => {
      const y = num(r.y);
      return y === null ? null : y - width / 2;
    },
    description: `origin bottom-left corner of a ${length} x ${width} surface`,
  };
}

/**
 * Move data rows into a surface's frame. Returns new rows (inputs untouched) with `surface_x`/`surface_y`
 * (or the names in `out`) added; missing or non-numeric inputs give `null`.
 *
 * `x`/`y` name the input columns (default `x`/`y`, or `x_legacy`/`y_legacy` for `"nba-legacy"`). The frame sees
 * a view `{ x: row[xCol], y: row[yCol] }`.
 */
export function toSurfaceFrame<R extends Row>(
  rows: readonly R[],
  o: { from: FrameName | Frame; x?: string; y?: string; out?: { x?: string; y?: string } },
): (R & { surface_x: number | null; surface_y: number | null })[] {
  const nba = o.from === "nba-legacy";
  const f: Frame = typeof o.from === "string" ? FRAMES[o.from] : o.from;
  const xc = o.x ?? (nba ? "x_legacy" : "x");
  const yc = o.y ?? (nba ? "y_legacy" : "y");
  const ox = o.out?.x ?? "surface_x";
  const oy = o.out?.y ?? "surface_y";
  return rows.map((r) => {
    const view: Row = { x: r[xc], y: r[yc] };
    return { ...r, [ox]: f.x(view), [oy]: f.y(view) } as R & {
      surface_x: number | null;
      surface_y: number | null;
    };
  });
}
