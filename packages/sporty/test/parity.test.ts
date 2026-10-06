import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import { footballField } from "../src/football/field.js";
import { hockeyRink } from "../src/hockey/rink.js";
import type { Scene } from "../src/scene.js";
import { BASKETBALL_LEAGUES } from "../src/specs/basketball.js";
import { FOOTBALL_LEAGUES } from "../src/specs/football.js";
import { HOCKEY_LEAGUES } from "../src/specs/hockey.js";
type Build = (
  league: string,
  opts?: {
    arcResolution?: number;
    displayRange?: never;
    rotation?: number;
    xTrans?: number;
    yTrans?: number;
  },
) => Scene;
const SURFACES: [sport: string, leagues: readonly string[], build: Build][] = [
  ["basketball", BASKETBALL_LEAGUES, basketballCourt as Build],
  ["hockey", HOCKEY_LEAGUES, hockeyRink as Build],
  ["football", FOOTBALL_LEAGUES, footballField as Build],
];
/** toBeCloseTo(v, 9) ⇔ |Δ| < 5e-10; asserted once per layer (max over its points) to keep the suite fast. */
const TOL = 5e-10;
const csv = (p: URL) =>
  readFileSync(p, "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => l.split(","));
for (const [sport, leagues, build] of SURFACES)
  describe.each(leagues.filter((l) => l !== "custom"))(`${sport} %s`, (league) => {
    const dir = new URL(`../../../fixtures/sporty/${sport}/${league.replace(/ /g, "_")}/`, import.meta.url);
    const files = (prefix: string) =>
      readdirSync(dir)
        .filter((f) => f.startsWith(prefix))
        .sort();
    // A league in the vendored JSON without fixtures fails here until `pnpm oracle:sporty <sport>` is re-run.
    test("R fixtures exist", () => {
      expect(existsSync(dir), `missing ${dir.pathname}`).toBe(true);
    });
    test("every R polygon layer matches point-for-point", () => {
      const polys = build(league, { arcResolution: 1000 }).features.filter((f) => f.kind === "polygon");
      const layers = files("layer_");
      expect(polys.length).toBe(layers.length);
      layers.forEach((file, k) => {
        const rows = csv(new URL(file, dir));
        const p = polys[k]!;
        expect(p.points.length, `${file} point count`).toBe(rows.length);
        let delta = 0;
        const fills: string[] = [];
        rows.forEach(([x, y, fill], i) => {
          const [px, py] = p.points[i]!;
          delta = Math.max(delta, Math.abs(px - Number(x)), Math.abs(py - Number(y)));
          if (fill && fill !== "NA" && p.fill.toLowerCase() !== fill.toLowerCase())
            fills.push(`${i}: ${p.fill} != ${fill}`);
        });
        expect(delta, `${file} max |Δ|`).toBeLessThan(TOL);
        expect(fills, `${file} fills`).toEqual([]);
      });
    }, 60_000);
    test("every R ggfittext layer matches box centre, label and angle", () => {
      const texts = build(league).features.filter((f) => f.kind === "text");
      const rows = files("text_").flatMap((file) => csv(new URL(file, dir)));
      expect(texts.length).toBe(rows.length);
      let delta = 0;
      const labels: string[] = [];
      rows.forEach(([x, y, label, angle], k) => {
        const t = texts[k]!;
        delta = Math.max(
          delta,
          Math.abs(t.x - Number(x)),
          Math.abs(t.y - Number(y)),
          Math.abs(t.rotation - Number(angle)),
        );
        if (t.text !== label) labels.push(`${k}: ${t.text} != ${label}`);
      });
      expect(delta, "max |Δ| over x, y, angle").toBeLessThan(TOL);
      expect(labels).toEqual([]);
    });
    test("display range bboxes match coord_fixed limits", () => {
      for (const file of files("bbox_").filter((f) => !f.includes("rot90"))) {
        const range = file.slice(5, -4).replace(/_/g, " ");
        const [x0, y0, x1, y1] = csv(new URL(file, dir))[0]!.map(Number);
        expect(build(league, { displayRange: range as never }).bbox).toEqual(
          [x0, y0, x1, y1].map((v) => expect.closeTo(v!, 9)),
        );
      }
      const [x0, y0, x1, y1] = csv(new URL("bbox_rot90_t10_-5.csv", dir))[0]!.map(Number);
      expect(build(league, { rotation: 90, xTrans: 10, yTrans: -5 }).bbox).toEqual(
        [x0, y0, x1, y1].map((v) => expect.closeTo(v!, 9)),
      );
    });
  });
