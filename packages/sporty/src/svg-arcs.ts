import type { Point, Polygon } from "./scene.js";

/** points[start..end] inclusive lie on the circle; a0/a1 radians at start/end; a1 − a0 keeps the sign of the sampled direction. */
export interface ArcRun {
  start: number;
  end: number;
  cx: number;
  cy: number;
  r: number;
  a0: number;
  a1: number;
}

/** Defaults 8, 1e-9 (relative to r for the radius, absolute for the angular step). */
export interface DetectArcsOptions {
  minPoints?: number;
  tol?: number;
}

/** Number formatter shared by both path variants: `precision` decimals, trailing zeros trimmed, no "-0". */
export function fmt(v: number, precision: number): string {
  const t0 = v.toFixed(precision);
  const t = t0.includes(".") ? t0.replace(/\.?0+$/, "") : t0;
  return t === "-0" || t === "" ? "0" : t;
}

const TWO_PI = 2 * Math.PI;

/** Normalize an angle difference to (−π, π]. */
const norm = (a: number): number => {
  let x = a % TWO_PI;
  if (x <= -Math.PI) x += TWO_PI;
  else if (x > Math.PI) x -= TWO_PI;
  return x;
};

/** Finds maximal runs of ≥ minPoints consecutive points that lie on one circle with equal angular steps. Pure; never alters `points`. */
export function detectArcs(points: Polygon, opts: DetectArcsOptions = {}): ArcRun[] {
  const minPoints = opts.minPoints ?? 8;
  const tol = opts.tol ?? 1e-9;
  const runs: ArcRun[] = [];
  const n = points.length;
  let i = 0;
  while (i + 2 < n) {
    const [ax, ay] = points[i]!;
    const [bx, by] = points[i + 1]!;
    const [qx, qy] = points[i + 2]!;
    if (![ax, ay, bx, by, qx, qy].every(Number.isFinite)) {
      i++; // a NaN/Infinity coordinate must not seed (or poison) a run
      continue;
    }
    const d = 2 * (ax * (by - qy) + bx * (qy - ay) + qx * (ay - by));
    const scale = Math.max(
      1,
      Math.abs(ax),
      Math.abs(ay),
      Math.abs(bx),
      Math.abs(by),
      Math.abs(qx),
      Math.abs(qy),
    );
    if (Math.abs(d) < 1e-12 * scale) {
      i++; // collinear
      continue;
    }
    const a2 = ax * ax + ay * ay;
    const b2 = bx * bx + by * by;
    const q2 = qx * qx + qy * qy;
    const cx = (a2 * (by - qy) + b2 * (qy - ay) + q2 * (ay - by)) / d;
    const cy = (a2 * (qx - bx) + b2 * (ax - qx) + q2 * (bx - ax)) / d;
    const r = Math.hypot(ax - cx, ay - cy);
    const angle = (q: Point): number => Math.atan2(q[1] - cy, q[0] - cx);
    const a0 = angle(points[i]!);
    const step = norm(angle(points[i + 1]!) - a0);
    const rTol = tol * Math.max(1, r);
    let j = i + 1;
    let prev = angle(points[j]!);
    let total = step; // the unwrapped sweep actually traversed (extrapolating `step` drifts ~1e-9 over 200 points)
    while (j + 1 < n) {
      const q = points[j + 1]!;
      // negated `<=` so a NaN coordinate breaks the run instead of being swallowed
      if (!(Math.abs(Math.hypot(q[0] - cx, q[1] - cy) - r) <= rTol)) break;
      const a = angle(q);
      const da = norm(a - prev);
      if (!(Math.abs(da - step) <= tol)) break;
      total += da;
      prev = a;
      j++;
    }
    if (j - i + 1 >= minPoints) {
      runs.push({ start: i, end: j, cx, cy, r, a0, a1: a0 + total });
      i = j; // the run's last point may start the next run (R's outer/inner arc seam)
    } else i++;
  }
  return runs;
}

/** Re-samples an ArcRun the way createCircle would: n = end − start + 1 points from a0 to a1. Used by tests and by nothing else. */
export function resampleArc(run: ArcRun): Point[] {
  const n = run.end - run.start + 1;
  const out: Point[] = [];
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? run.a0 : run.a0 + ((run.a1 - run.a0) * k) / (n - 1);
    out.push([run.cx + run.r * Math.cos(t), run.cy + run.r * Math.sin(t)]);
  }
  return out;
}

/**
 * Path data for one polygon: "M x y L … Z" when arcs is "sampled"; with "svg" each ArcRun becomes
 * `ceil(|span| / (π/2))` equal `A r r 0 0 sweep x y` commands (one per quarter turn, so a full circle is
 * four), each ending on the true circle. A half circle as one `A` locates its centre from the rounded
 * endpoints ill-conditionedly (error ≈ √(2rδ): 3.4 px at `precision` 2); quarters stay within the
 * sampled path's error. A run spanning more than one turn cannot be drawn with arcs and is emitted as `L`
 * segments.
 */
export function pathData(points: Polygon, arcs: "sampled" | "svg", precision: number): string {
  const f = (v: number): string => fmt(v, precision);
  if (arcs === "sampled")
    return `${points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${f(x)} ${f(y)}`).join(" ")} Z`;
  const n = points.length;
  if (n === 0) return " Z";
  const runs = detectArcs(points);
  const parts: string[] = [`M ${f(points[0]![0])} ${f(points[0]![1])}`];
  let ri = 0;
  let i = 0;
  while (i < n - 1) {
    const run = runs[ri];
    if (run !== undefined && run.start === i && Math.abs(run.a1 - run.a0) > TWO_PI + 1e-9) {
      ri++; // more than one turn (custom scenes only; sportyR never emits one): fall through to L segments
      continue;
    }
    if (run !== undefined && run.start === i) {
      const span = run.a1 - run.a0;
      const sweep = span > 0 ? 1 : 0;
      const rr = `${f(run.r)} ${f(run.r)}`;
      const [ex, ey] = points[run.end]!;
      const k = Math.max(1, Math.ceil((Math.abs(span) - 1e-9) / (Math.PI / 2)));
      for (let s = 1; s < k; s++) {
        const a = run.a0 + (span * s) / k;
        parts.push(
          `A ${rr} 0 0 ${sweep} ${f(run.cx + run.r * Math.cos(a))} ${f(run.cy + run.r * Math.sin(a))}`,
        );
      }
      parts.push(`A ${rr} 0 0 ${sweep} ${f(ex)} ${f(ey)}`);
      i = run.end;
      ri++;
    } else {
      i++;
      parts.push(`L ${f(points[i]![0])} ${f(points[i]![1])}`);
    }
  }
  parts.push("Z");
  return parts.join(" ");
}
