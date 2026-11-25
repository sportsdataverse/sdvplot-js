import { addAthleteId } from "@sportsdataverse/sdvplot";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "ESPN athlete ids for college football player names (cfbplotR's add_athlete_id_col)",
  tags: ["addAthleteId", "network", "cfb", "headshots"],
} satisfies ExampleMeta;

// Downloads cfbfastR-data's 2021 roster once (about 3 MB). The output on this page was prerendered offline, where the
// roster URL answers from a two-player sample of the real file (fixtures/examples/cfb_rosters_2021_sample.csv).
// two real 2021 players; case and the team's other names ("UGA") do not matter
const names = ["Britain Covey", "jt daniels"];
const schools = ["Utah", "UGA"];
const players = names.map((name, i) => ({ name, school: schools[i], season: 2021 }));
export default await addAthleteId(players, "name", { headshotUrls: true });
