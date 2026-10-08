// The data steps of the "Workflows with sdv-js" pages, from sportsdataverse-js's parsed sections to the rows a chart
// draws. Plain functions of parsed rows, so examples/test/sdvjs-snapshots.test.ts runs them on the committed snapshots.

// Win probability, one row per entry, joined to its play on the play id (the first entry is the pregame line, with
// no play). `section` is `(name) => parseEndpoint("espn", "summary", raw, name)`.
export function winProbability(section) {
  const comp = JSON.parse(section("header")[0].competitions)[0];
  const side = (s) => comp.competitors.find((c) => c.homeAway === s);
  const home = side("home");
  const away = side("away");
  const playById = new Map(section("drive_plays").map((p) => [p.id, p]));
  let prev = null;
  const rows = section("winprobability").map((w, i) => {
    const p = playById.get(w.play_id);
    const row = {
      i,
      wp: w.home_win_percentage,
      swing: prev === null ? 0 : w.home_win_percentage - prev,
      matched: p !== undefined,
      period: p?.period_number ?? 1,
      when: p ? `${p.period_number > 4 ? "OT" : `Q${p.period_number}`} ${p.clock_display_value}` : "Pregame",
      score: p ? `${away.team.abbreviation} ${p.away_score}, ${home.team.abbreviation} ${p.home_score}` : "",
      play: p?.text ?? "Before kickoff",
      type: p?.type_text ?? "",
    };
    prev = w.home_win_percentage;
    return row;
  });
  return { comp, home, away, rows };
}

// ESPN's basketball frame, measured by sportsdataverse-js against the distance in each play's text: x is feet across
// the court, 0 to 50 with the hoop at 25; y is feet from the hoop toward half court, the hoop at y = 1; both teams shoot
// at one basket; a free throw has no location (a -214748340 sentinel). sporty's half court has the hoop at x = 41.75.
export const ESPN_BASKETBALL = {
  x: (r) => (r.y == null || r.y < -100 ? null : 41.75 - (r.y - 1)),
  y: (r) => (r.x == null || r.x < -100 ? null : r.x - 25),
  description: "ESPN basketball plays onto sporty's offensive half court",
};

// The field-goal attempts with a location, each with its shooter (the play's first participant).
export const fieldGoals = (plays) =>
  plays
    .filter(
      (p) =>
        p.shooting_play && p.coordinate_x > -100 && p.coordinate_y > -100 && !/free throw/i.test(p.type_text),
    )
    .map((p) => ({ ...p, shooter_id: JSON.parse(p.participants || "[]")[0]?.athlete?.id }));

// The types a key holds across rows ("string", "number", or both), ignoring missing values.
export const idTypes = (rows, key) =>
  [...new Set(rows.filter((r) => r[key] != null).map((r) => typeof r[key]))].sort().join("/");

// Throws unless the two sides of a join hold one and the same type: a string id never equals a number, so a
// mismatch would join nothing, silently.
export function checkJoinKey(left, leftKey, right, rightKey) {
  const a = idTypes(left, leftKey);
  const b = idTypes(right, rightKey);
  if (a !== b || a.includes("/"))
    throw new Error(
      `the join key differs in type: ${leftKey} is ${a || "missing"}, ${rightKey} is ${b || "missing"}`,
    );
}

// One box-score row per player who played, with the charted attempts beside the box score's.
export function boxScore(box, shots) {
  const attempts = (b) =>
    Number(String(b.field_goals_made_field_goals_attempted ?? "0-0").split("-")[1]) || 0;
  return box
    .filter((b) => !b.did_not_play)
    .map((b) => ({
      id: b.athlete_id,
      name: b.athlete_display_name,
      team: b.team_id,
      min: Number(b.minutes) || 0,
      pts: Number(b.points) || 0,
      fg: b.field_goals_made_field_goals_attempted,
      three: b.three_point_field_goals_made_three_point_field_goals_attempted,
      reb: Number(b.rebounds) || 0,
      ast: Number(b.assists) || 0,
      pm: Number(b.plus_minus) || 0,
      fga: attempts(b),
      charted: shots.filter((s) => s.shooter_id === b.athlete_id).length,
    }));
}

// A game log's parsed rows joined to the events beside them, oldest first. The stats are positional (`stat_0` ...);
// `raw.names` says which is which, so each is looked up by name.
export function gameLog(raw, rows) {
  const col = (name) => `stat_${raw.names.indexOf(name)}`;
  return rows
    .map((r) => {
      const e = raw.events?.[r.event_id] ?? {};
      return {
        event_id: r.event_id,
        block: r.season_type_name,
        date: new Date(e.gameDate),
        day: e.gameDate?.slice(0, 10) ?? "",
        opp: `${e.atVs ?? ""} ${e.opponent?.abbreviation ?? ""}`.trim(),
        result: `${e.gameResult ?? ""} ${e.score ?? ""}`.trim(),
        note: e.eventNote ?? "",
        team: e.team?.id,
        points: Number(r[col("points")]),
        rebounds: Number(r[col("totalRebounds")]),
        assists: Number(r[col("assists")]),
        minutes: Number(r[col("minutes")]),
      };
    })
    .sort((a, b) => a.date - b.date);
}

// ESPN files exhibitions under "Regular Season": the All-Star Game and the in-season cup finals (the In-Season
// Tournament, the NBA Cup, the WNBA Commissioner's Cup), none of which count in a player's season stats.
export const EXHIBITION = /All-Star|(In-Season Tournament|NBA Cup|Commissioner's Cup).*Championship/;
const regularBlock = (g) => / Regular Season$/.test(g.block) && !/Play In/.test(g.block);
export const BLOCKS = {
  "Regular season": (g) => regularBlock(g) && !EXHIBITION.test(g.note),
  Postseason: (g) => / Postseason$/.test(g.block),
  "Every game": () => true,
};
export const exhibitions = (games) => games.filter((g) => regularBlock(g) && EXHIBITION.test(g.note));
