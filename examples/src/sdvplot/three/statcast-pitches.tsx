import { STATCAST_PITCHES_2024_06_15 } from "@sportsdataverse/examples/data";
import { loadLeague } from "@sportsdataverse/sdvplot";
import { Surface3D, Trajectory } from "@sportsdataverse/sdvplot/react";
import {
  statcastPitchPath,
  surfaceMesh,
  teamColorPalette,
  trajectoryTube,
} from "@sportsdataverse/sdvplot/three";
import type { ExampleMeta } from "../../contract.js";

export const meta = {
  title:
    "Three.js: two strikeouts of 2024-06-15 pitch by pitch, each Statcast pitch's flight over sporty's 3D baseball field in the pitching team's colour (react-three-fiber)",
  tags: ["three", "react-three-fiber", "Surface3D", "Trajectory", "statcastPitchPath", "mlb", "statcast"],
} satisfies ExampleMeta;

await loadLeague("mlb");
// From Baseball Savant's pitch-level search for 2024-06-15 (MLB Advanced Media data): all four pitches of Jamie
// Westbrook's strikeout against the Yankees at Fenway Park (a curveball, a changeup, a slider, then a 96.3 mph
// four-seamer he swung through), and the curveball Cavan Biggio took for strike three against the Royals at Dodger
// Stadium. Both come in a bottom half, so the away team pitches.
const PITCHES = [
  [746946, 48, [1, 2, 3, 4]],
  [746135, 51, [5]],
] as const;
const pitches = PITCHES.flatMap(([game, ab, numbers]) =>
  numbers.map((n) => {
    const p = STATCAST_PITCHES_2024_06_15.find(
      (q) => q.game_pk === game && q.at_bat_number === ab && q.pitch_number === n,
    );
    if (p === undefined) throw new Error(`no pitch ${n} of at-bat ${ab} in game ${game}`);
    return p;
  }),
);
const pitching = (p: (typeof pitches)[number]): string =>
  p.inning_topbot === "Bot" ? p.away_team : p.home_team;

// Statcast's frame is sporty's baseball frame (home plate's point at the origin, y towards the mound, feet), so each
// pitch's path draws over the field as it is. The tubes are a baseball's radius, and each team's colour is one that
// reads on the outfield grass (the field's background) and stays distinct from the other's: the Yankees' gray and
// the Royals' powder blue, their own second colours, where their navy and royal blue would sink into the grass.
const field = surfaceMesh("baseball", "mlb");
const grass = field.loops[0]?.color ?? "#395d33";
const teams = [...new Set(pitches.map(pitching))];
const colors = teamColorPalette("mlb", teams, { background: grass });
if (String(colors) !== String(teamColorPalette("mlb", teams, { which: "secondary" })))
  throw new Error(`expected each team's own second colour on the grass, got ${colors}`);
const BALL = 0.121; // a baseball's radius, ft (9 to 9.25 in around)
const flights = pitches.map((p) => ({
  p,
  team: pitching(p),
  color: colors[teams.indexOf(pitching(p))] as string,
  path: statcastPitchPath(p),
}));

// In the browser, react-three-fiber draws the field and the five flights, seen from the third-base side; drag to turn
// the camera round them.
export const browser = {
  lib: "three",
  scene: () => (
    <>
      <Surface3D sport="baseball" league="mlb" />
      {flights.map((f) => (
        <Trajectory
          key={`${f.p.game_pk}-${f.p.pitch_number}`}
          points={f.path}
          radius={BALL}
          color={f.color}
        />
      ))}
    </>
  ),
  camera: { position: [-54, 6, 14], target: [0, 27, 3], fov: 40 },
  width: 720,
  height: 420,
  label:
    "Five pitches of 2024-06-15 (Baseball Savant) drawn as tubes over a baseball field, each from the pitcher's hand to home plate: the Yankees' four to Jamie Westbrook in gray and the Royals' strike-three curveball to Cavan Biggio in powder blue",
} as const;

// Three.js draws only in a browser; without JavaScript the page shows what the meshes hold.
export default {
  field: { loops: field.loops.length, triangles: field.indices.length / 3, units: field.units },
  pitches: flights.map((f) => {
    const tube = trajectoryTube(f.path, { radius: BALL, color: f.color });
    return {
      team: f.team,
      batter: f.p.player_name,
      pitch: f.p.pitch_number,
      type: f.p.pitch_name,
      mph: f.p.release_speed,
      call: f.p.description,
      color: tube.color,
      feet: Number(tube.length.toFixed(2)),
    };
  }),
};
