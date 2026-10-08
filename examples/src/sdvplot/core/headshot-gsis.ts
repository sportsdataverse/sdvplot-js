import { headshotUrl, loadGsis } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "Headshots by nflverse gsis id",
  tags: ["headshots", "gsis", "nfl"],
} satisfies ExampleMeta;

// The gsis map ships with the package as its own chunk; loadGsis imports it (nothing is downloaded).
await loadGsis();

export default {
  "Patrick Mahomes (00-0033873)": headshotUrl("00-0033873", "nfl", { idSystem: "gsis" }),
  "Josh Allen (00-0034857)": headshotUrl("00-0034857", "nfl", { idSystem: "gsis" }),
};
