import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { basketballCourt } from "../src/basketball/court.js";
import { hockeyRink } from "../src/hockey/rink.js";
import type { Scene } from "../src/scene.js";
import { BASKETBALL_LEAGUES } from "../src/specs/basketball.js";
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
];
const csv = (p: URL) =>
  readFileSync(p, "utf8")
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => l.split(","));
for (const [sport, leagues, build] of SURFACES)
  describe.each(leagues.filter((l) => l !== "custom"))(`${sport} %s`, (league) => {
    const dir = new URL(`../../../fixtures/sporty/${sport}/${league.replace(/ /g, "_")}/`, import.meta.url);
    test.skipIf(!existsSync(dir))(
      "every R polygon layer matches point-for-point",
      () => {
        const scene = build(league, { arcResolution: 1000 });
        const polys = scene.features.filter((f) => f.kind === "polygon");
        const layers = readdirSync(dir)
          .filter((f) => f.startsWith("layer_"))
          .sort();
        expect(polys.length).toBe(layers.length);
        layers.forEach((file, k) => {
          const rows = csv(new URL(file, dir));
          const p = polys[k]!;
          expect(p.points.length, `${file} point count`).toBe(rows.length);
          rows.forEach(([x, y, fill], i) => {
            expect(p.points[i]![0]).toBeCloseTo(Number(x), 9);
            expect(p.points[i]![1]).toBeCloseTo(Number(y), 9);
            if (fill && fill !== "NA") expect(p.fill.toLowerCase()).toBe(fill.toLowerCase());
          });
        });
      },
      60_000,
    );
    test.skipIf(!existsSync(dir))("display range bboxes match coord_fixed limits", () => {
      for (const file of readdirSync(dir).filter((f) => f.startsWith("bbox_") && !f.includes("rot90"))) {
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
