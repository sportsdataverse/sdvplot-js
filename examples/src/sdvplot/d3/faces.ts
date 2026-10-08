import { appendHeadshots } from "@sportsdataverse/sdvplot/d3";
import { create } from "d3";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title: "d3: circular headshot faces with a ring and a placeholder disc",
  tags: ["d3", "appendHeadshots", "faces", "nfl"],
} satisfies ExampleMeta;

// Seven NFL players by ESPN athlete id, with the names ESPN gives them. clip: "circle" crops each headshot to a face,
// and the placeholder disc stays behind it if the image fails to load.
const players = [
  { id: "4432773", name: "Brian Thomas Jr." },
  { id: "4243389", name: "Calvin Austin III" },
  { id: "4374302", name: "Amon-Ra St. Brown" },
  { id: "4429160", name: "De'Von Achane" },
  { id: "4047646", name: "A.J. Brown" },
  { id: "3133487", name: "Andrew Van Ginkel" },
  { id: "3139477", name: "Patrick Mahomes" },
];
const [width, height] = [700, 120];
const x = (i: number): number => 50 + i * 100;
const svg = create("svg").attr("viewBox", [0, 0, width, height]).attr("width", width);
appendHeadshots(
  svg,
  players.map((_, i) => i),
  players.map(() => 0),
  players.map((p) => p.id),
  {
    league: "nfl",
    x: (v) => x(Number(v)),
    y: () => 50,
    frameHeight: height,
    height: 0.6,
    clip: "circle",
    ring: "#525252",
    placeholder: "#d4d4d4",
  },
);
svg
  .append("g")
  .attr("font-size", 11)
  .attr("text-anchor", "middle")
  .attr("fill", "currentColor")
  .selectAll("text")
  .data(players)
  .join("text")
  .attr("x", (_, i) => x(i))
  .attr("y", 110)
  .text((p) => p.name);
export default svg.node();
