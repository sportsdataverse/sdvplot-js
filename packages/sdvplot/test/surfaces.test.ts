import { beforeAll, expect, test } from "vitest";
import { loadLeague, teamColorsSync } from "../src/index.js";
import { surfaceScene } from "../src/surfaces.js";

beforeAll(() => loadLeague("nhl"), 60_000);
test("surfaceScene paints the boards in the team's primary colour", () => {
  const [primary] = teamColorsSync("nhl", ["BOS"], { which: "primary" });
  const scene = surfaceScene("nhl", { team: "BOS" });
  const boards = scene.features.filter(
    (f) => f.kind === "polygon" && f.fill.toLowerCase() === primary?.toLowerCase(),
  );
  expect(boards.length).toBeGreaterThan(0);
  expect(scene.sport).toBe("hockey");
});
