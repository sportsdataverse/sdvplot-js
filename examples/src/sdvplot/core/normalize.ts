import {
  InputError,
  LEAGUES,
  VARIANTS,
  latestSeason,
  normSeason,
  normValue,
  seasonBounds,
} from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "How values and seasons are normalised",
  tags: ["normValue", "normSeason", "seasons"],
} satisfies ExampleMeta;

let splitSeason = "";
try {
  normSeason("2020-21");
} catch (e) {
  if (e instanceof InputError) splitSeason = e.message;
}

export default {
  // Ids compare as text: an integral float loses its ".0"; case and accents fold.
  "normValue('12.0')": normValue("12.0"),
  "normValue(' Montréal ')": normValue(" Montréal "),
  "normSeason(2020)": normSeason(2020),
  "normSeason('2020-21')": splitSeason,
  "seasonBounds('nfl')": seasonBounds("nfl"),
  "latestSeason('nfl')": latestSeason("nfl"),
  "LEAGUES.length": LEAGUES.length,
  "VARIANTS.length": VARIANTS.length,
};
