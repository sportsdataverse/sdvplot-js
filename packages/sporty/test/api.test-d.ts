import { expectTypeOf, test } from "vitest";
import { basketballCourt, footballField, hockeyRink, surface } from "../src/index.js";
import type { Scene, Sport } from "../src/index.js";

declare const anySport: Sport;
declare const twoSports: "basketball" | "hockey";

test("surface() rejects misspelled options per sport (spec §2)", () => {
  // @ts-expect-error misspelled `updates`
  surface("basketball", "nba", { updats: { court_length: 90 } });
  // @ts-expect-error misspelled key inside `updates`
  surface("basketball", "nba", { updates: { court_lenght: 90 } });
  // @ts-expect-error misspelled `colorUpdates`
  surface("basketball", "nba", { colourUpdates: { court_apron: "#000000" } });
  // @ts-expect-error misspelled key inside `colorUpdates`
  surface("basketball", "nba", { colorUpdates: { court_aprn: "#000000" } });
  // @ts-expect-error not a basketball display range
  surface("basketball", "nba", { displayRange: "midcourt" });
  // @ts-expect-error a basketball colour key is not a hockey one
  surface("hockey", "nhl", { colorUpdates: { court_apron: "#000000" } });
  // @ts-expect-error misspelled football option
  surface("football", "nfl", { rotaton: 90 });
  expectTypeOf(surface("basketball", "nba", { displayRange: "offense" })).toEqualTypeOf<Scene>();
  expectTypeOf(surface("hockey", "my league")).toEqualTypeOf<Scene>(); // league stays an open string
});

test("a runtime Sport (or a union) compiles through the generic overload", () => {
  expectTypeOf(surface(anySport, "nba")).toEqualTypeOf<Scene>();
  expectTypeOf(surface(twoSports, "nba", { arcResolution: 100 })).toEqualTypeOf<Scene>();
  // @ts-expect-error a key no member of the union accepts
  surface(twoSports, "nba", { arcResolutoin: 100 });
});

test("assemblers reject misspelled option keys", () => {
  // @ts-expect-error misspelled `xTrans`
  basketballCourt("nba", { xtrans: 1 });
  // @ts-expect-error misspelled `displayRange`
  hockeyRink("nhl", { display_range: "ozone" });
  // @ts-expect-error misspelled `colorUpdates`
  footballField("nfl", { colorUpdate: { field_apron: "#000000" } });
});
