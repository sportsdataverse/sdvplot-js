import {
  SdvplotError,
  UnresolvedTeamError,
  loadLeague,
  resetWarnings,
  resolveSync,
  setWarningHandler,
} from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "One warning per distinct set of unresolved values, or strict errors",
  tags: ["resolve", "warnings", "strict", "nfl"],
} satisfies ExampleMeta;

await loadLeague("nfl");
const seen: string[] = [];
setWarningHandler((message) => seen.push(message)); // instead of console.warn
resolveSync(["KC", "XYZ"], "nfl"); // [KC's id, undefined] and one warning
resolveSync(["KC", "XYZ"], "nfl"); // the same warning again: silent
resetWarnings();
resolveSync(["KC", "XYZ"], "nfl"); // warns again
setWarningHandler(null); // back to console.warn

let error = "";
try {
  resolveSync(["KC", "XYZ"], "nfl", { strict: true });
} catch (e) {
  if (e instanceof UnresolvedTeamError && e instanceof SdvplotError) error = `${e.name}: ${e.message}`;
}

export default { warning: seen[0], timesWarned: seen.length, error };
