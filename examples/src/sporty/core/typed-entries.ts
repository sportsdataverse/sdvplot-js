import {
  baseballField,
  basketballCourt,
  curlingSheet,
  footballField,
  hockeyRink,
  lacrosseField,
  soccerPitch,
  tennisCourt,
  volleyballCourt,
} from "@sportsdataverse/sporty";
import { toSVG } from "@sportsdataverse/sporty/svg";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "One typed entry per sport",
  tags: ["surface", "typed entries", "toSVG"],
} satisfies ExampleMeta;

// Each sport also has its own entry point, typed to that sport's leagues and options.
const scenes = [
  basketballCourt("nba"),
  hockeyRink("nhl"),
  footballField("nfl"),
  soccerPitch("epl"),
  baseballField("mlb"),
  tennisCourt("atp"),
  volleyballCourt("fivb"),
  curlingSheet("wcf"),
  lacrosseField("nll"),
];

const cells = scenes.map(
  (s) =>
    `<figure style="margin:0">${toSVG(s, { width: 200, arcs: "svg", precision: 2 })}<figcaption>${s.sport}: ${s.league}</figcaption></figure>`,
);
export default `<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:end">${cells.join("")}</div>`;
