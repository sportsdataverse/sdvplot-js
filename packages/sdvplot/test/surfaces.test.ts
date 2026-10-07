import { SportyError } from "@sportsdataverse/sporty";
import { beforeAll, expect, test } from "vitest";
import { InputError, loadLeague, resetWarnings, setWarningHandler, teamColorsSync } from "../src/index.js";
import { SURFACES, surfaceScene } from "../src/surfaces.js";

beforeAll(async () => {
  await Promise.all(["nhl", "ohl", "nba"].map((l) => loadLeague(l as never)));
}, 60_000);
const fill = (scene: ReturnType<typeof surfaceScene>, name: string) => {
  const f = scene.features.find((x) => x.kind === "polygon" && x.name === name);
  return f?.kind === "polygon" ? f.fill.toLowerCase() : undefined;
};
const primaryOf = (league: "nhl" | "ohl" | "nba", team: string) =>
  teamColorsSync(league, [team], { which: "primary" })[0]?.toLowerCase();

test("surfaceScene paints the boards in the team's primary colour", () => {
  const scene = surfaceScene("nhl", { team: "BOS" });
  expect(fill(scene, "boards")).toBe(primaryOf("nhl", "BOS"));
  expect(scene.sport).toBe("hockey");
});
test("an unresolved team draws the plain surface and warns exactly once", () => {
  const msgs: string[] = [];
  resetWarnings();
  setWarningHandler((m) => msgs.push(m));
  try {
    const scene = surfaceScene("nhl", { team: "ZZZ-nobody" });
    expect(fill(scene, "boards")).toBe(fill(surfaceScene("nhl"), "boards"));
    expect(msgs).toHaveLength(1);
  } finally {
    setWarningHandler(null);
    resetWarnings();
  }
});
test("a team with no secondary colour accents with its primary", () => {
  const scene = surfaceScene("ohl", { team: "6" });
  const p = primaryOf("ohl", "6");
  expect(p).toBeDefined();
  expect(fill(scene, "boards")).toBe(p);
  expect(fill(scene, "center_line")).toBe(p);
});
test("user colorUpdates override a painted key", () => {
  const scene = surfaceScene("nba", { team: "LAL", colorUpdates: { painted_area: "#123456" } });
  expect(fill(scene, "painted_area")).toBe("#123456");
  expect(fill(scene, "court_apron")).toBe(primaryOf("nba", "LAL"));
});
test("sporty errors escape unwrapped, not as InputError", () => {
  for (const o of [{ displayRange: "nope" as never }, { units: "furlong" as never }]) {
    let err: unknown;
    try {
      surfaceScene("nhl", o);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SportyError);
    expect(err).not.toBeInstanceOf(InputError);
  }
});
test("every SURFACES entry builds a non-empty scene (guards typo'd sporty league keys)", () => {
  for (const league of Object.keys(SURFACES)) {
    expect(surfaceScene(league as never).features.length, league).toBeGreaterThan(0);
  }
});
