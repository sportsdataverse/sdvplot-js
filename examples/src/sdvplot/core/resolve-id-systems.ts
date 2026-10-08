import { EXPLICIT_ONLY, PRIORITY, resolve } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "One team, three id systems",
  tags: ["resolve", "idSystem", "nfl"],
} satisfies ExampleMeta;

// "auto" tries the systems in PRIORITY order; the first one holding the value decides.
const auto = await resolve(["12", "KC", "Kansas City Chiefs"], "nfl");
// Name the system when you know it: "12" is ESPN's id for Kansas City.
const espn = await resolve("12", "nfl", { idSystem: "espn" });
const name = await resolve("Kansas City Chiefs", "nfl", { idSystem: "name" });

export default {
  auto,
  espn,
  name,
  PRIORITY,
  // Systems "auto" never tries: pass them as idSystem.
  EXPLICIT_ONLY,
};
