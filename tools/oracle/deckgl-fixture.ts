// The shared deck.gl / pydeck fixture: real rows, the layer props sdvplot-js's `./deckgl` builds from them, and the
// shared team palette on every NBA, NFL, MLB and NHL team. sdvplot (Python) commits the same bytes as
// tests/fixtures/deckgl_shared.json and its `sdvplot.pydeck` must reproduce every value in it; sdvplot-js's
// packages/sdvplot/test/deckgl-shared.test.ts holds `./deckgl` to it here. Never hand-edit the output.
// tools/oracle/deckgl.ts writes it (pnpm oracle:deckgl), and deckgl-shared.test.ts checks that this rebuilds the
// committed bytes, so the file never drifts from the adapter.

/** The shared fixture's text (with its final newline), built from the sources. */
export async function deckglSharedFixture(): Promise<string> {
  // tsx runs the sources without the build-time constants (vitest defines them)
  const g = globalThis as Record<string, unknown>;
  g.__SDVPLOT_VERSION__ ??= "0";
  g.__SPORTY_VERSION__ ??= "0";
  const { NHL_SHOTS, WC2018_FINAL_FRANCE_PASSES } = await import("../../examples/src/data.js");
  const { INDEX_VERSION } = await import("../../packages/sdvplot/src/data/index.js");
  const { setWarningHandler } = await import("../../packages/sdvplot/src/errors.js");
  const { getLeagueSync, loadLeague } = await import("../../packages/sdvplot/src/index-data.js");
  const { selectMarkSync } = await import("../../packages/sdvplot/src/marks.js");
  const { teamPalette } = await import("../../packages/sdvplot/src/team-palette.js");
  const { hex6 } = await import("../../packages/sdvplot/src/contrast.js");
  const { logoIconLayer, passArcLayer, surfaceLayer } = await import("../../packages/sdvplot/src/deckgl.js");

  const warnings: string[] = [];
  setWarningHandler((m) => warnings.push(m));
  for (const lg of ["nhl", "soccer", "nba", "nfl", "mlb"] as const) await loadLeague(lg);

  /** A props object as plain data: an accessor function becomes the name of the row field it returns. */
  function plain(props: Record<string, unknown>): { props: Record<string, unknown>; data: unknown[] } {
    const data = props.data as Record<string, unknown>[];
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (k === "data") continue;
      if (typeof v !== "function") {
        out[k] = v;
        continue;
      }
      const row = data[0] as Record<string, unknown>;
      const field = Object.keys(row).find((f) => row[f] === v(row));
      if (field === undefined) throw new Error(`${k} returns no field of the row`);
      out[k] = field;
    }
    return { props: out, data };
  }

  // NHL api-web's shot coordinates are feet from centre ice, the frame sporty's NHL rink is drawn in. Each shot aims
  // at the goal at its own end of the rink: the goal line is 89 ft from centre (sporty's nhl rink: 200 ft long, the
  // goal line 11 ft from the end boards), so the target is (89, 0) or (-89, 0) by the sign of the shot's x.
  const shots = NHL_SHOTS.map((s) => ({ ...s, net_x: Math.sign(s.x) * 89, net_y: 0 }));
  // The SPADL capture holds France's passes only: France is ESPN soccer team 478 (2755 is France's women's team).
  const passes = WC2018_FINAL_FRANCE_PASSES.map((p) => ({ ...p, team: "478" }));

  const ARC = {
    x: "start_x",
    y: "start_y",
    xend: "end_x",
    yend: "end_y",
    team: "team",
    league: "soccer",
  } as const;
  const cases = [
    {
      name: "nhl_shot_logos",
      builder: ["logoIconLayer", "logo_icon_layer"],
      layer: "IconLayer",
      input: "nhl_shots",
      options: { x: "x", y: "y", team: "team", league: "nhl" },
    },
    {
      name: "nhl_shot_logos_sized",
      builder: ["logoIconLayer", "logo_icon_layer"],
      layer: "IconLayer",
      input: "nhl_shots",
      options: { x: "x", y: "y", team: "team", league: "nhl", size: 24, alpha: 0.8, id: "shots" },
    },
    {
      name: "france_pass_arcs_flat",
      builder: ["passArcLayer", "pass_arc_layer"],
      layer: "ArcLayer",
      input: "france_passes",
      options: { ...ARC, idSystem: "team_id", tilt: 90, height: 0.3 },
    },
    {
      name: "france_pass_arcs_dark",
      builder: ["passArcLayer", "pass_arc_layer"],
      layer: "ArcLayer",
      input: "france_passes",
      options: { ...ARC, idSystem: "team_id", background: "#181a1b", width: 3 },
    },
    {
      name: "nhl_shots_to_goal_dark",
      builder: ["passArcLayer", "pass_arc_layer"],
      layer: "ArcLayer",
      input: "nhl_shots",
      options: {
        x: "x",
        y: "y",
        xend: "net_x",
        yend: "net_y",
        team: "team",
        league: "nhl",
        background: "#000000",
      },
    },
    {
      name: "nhl_shots_to_goal_secondary",
      builder: ["passArcLayer", "pass_arc_layer"],
      layer: "ArcLayer",
      input: "nhl_shots",
      options: {
        x: "x",
        y: "y",
        xend: "net_x",
        yend: "net_y",
        team: "team",
        league: "nhl",
        which: "secondary",
      },
    },
  ] as const;
  const inputs = { nhl_shots: shots, france_passes: passes } as const;
  const layers = cases.map((c) => {
    const rows = inputs[c.input];
    const built =
      c.layer === "IconLayer"
        ? logoIconLayer(rows, c.options as Parameters<typeof logoIconLayer>[1])
        : passArcLayer(rows, c.options as Parameters<typeof passArcLayer>[1]);
    return { ...c, ...plain(built as unknown as Record<string, unknown>) };
  });

  // The manifest rows the logos above come from, with the columns the Python manifest reads.
  const marks = [
    ...new Set(
      layers.flatMap((l) => (l.layer === "IconLayer" ? l.data.map((d) => (d as { team: string }).team) : [])),
    ),
  ]
    .sort()
    .map((id) => {
      const m = selectMarkSync(id, "nhl");
      const t = getLeagueSync("nhl").teams.find((x) => x.team_id === id);
      if (m === undefined || t === undefined) throw new Error(`no nhl logo for ${id}`);
      return {
        level: "team",
        league: "nhl",
        entity_id: id,
        entity_name: t.name,
        program: t.program ?? "pro",
        mark_type: m.mark_type,
        variant: m.variant,
        valid_from: m.valid_from,
        valid_to: m.valid_to,
        source: m.source,
        sha256: m.sha256,
        ext: m.ext,
        width: m.width,
        height: m.height,
        archive_url: m.archive_url,
        first_seen: m.first_seen,
      };
    });

  // Surfaces: each language draws its own sporty library's geometry (sporty here, sportypy in Python), which sample
  // arcs differently, so the vertices are not shared. Shared: the props, every fill colour, and the extent where the
  // two libraries agree.
  const extent = (data: { polygon: (readonly [number, number])[] }[], k: 0 | 1): [number, number] => {
    const v = data.flatMap((d) => d.polygon.map((p) => p[k]));
    return [Math.round(Math.min(...v) * 1e4) / 1e4, Math.round(Math.max(...v) * 1e4) / 1e4];
  };
  const fills = (data: { fillColor: number[] }[]): number[][] =>
    [...new Set(data.map((d) => JSON.stringify(d.fillColor)))].sort().map((s) => JSON.parse(s));
  const rink = surfaceLayer("hockey", "nhl");
  // Rows per feature name pin the ring rules both languages apply: a faceoff circle, spot ring or the centre circle is
  // two half rings in one path (the loop split), and a goaltender trapezoid crosses itself at a corner (the
  // self-crossing split: three rings per trapezoid). Left out: the faceoff hash marks, which sporty draws as 8 loops
  // that twist (24 rows once split) and sportypy as 16 that do not.
  const LOOPED = [
    "odzone_faceoff_circle",
    "nodzone_faceoff_spot_ring",
    "center_faceoff_circle",
    "goaltenders_restricted_area",
  ];
  const loops = Object.fromEntries(LOOPED.map((n) => [n, rink.data.filter((d) => d.name === n).length]));
  const pitch = surfaceLayer("soccer", "fifa", { updates: { pitch_length: 105, pitch_width: 68 } });
  const surfaces = [
    {
      name: "nhl_rink",
      sport: "hockey",
      league: "nhl",
      ...plain(rink as unknown as Record<string, unknown>),
      fills: fills(rink.data),
      extent_x: extent(rink.data, 0),
      loops,
      // no extent_y: sportypy 1.0 sets the penalty boxes 0.4167 ft (the boards' thickness) nearer centre ice than
      // sporty (sportyR's geometry), so the two rinks' lowest points differ; the adapters draw what each library gives
      extent_y: null,
    },
    {
      name: "fifa_pitch_105x68",
      sport: "soccer",
      league: "fifa",
      pitch: { pitch_length: 105, pitch_width: 68 },
      ...plain(pitch as unknown as Record<string, unknown>),
      fills: fills(pitch.data),
      extent_x: extent(pitch.data, 0),
      extent_y: extent(pitch.data, 1),
      loops: {},
    },
  ].map(({ data: _, ...s }) => s);

  // The shared team palette on every team of four leagues, in each league's standard order, on three backgrounds.
  const palettes = (["nba", "nfl", "mlb", "nhl"] as const).flatMap((lg) =>
    ["#181a1b", "#000000", "#ffffff"].map((background) => {
      const teams = getLeagueSync(lg).teams;
      const labels = teams.map((t) => t.team_id);
      const colors = teams.map((t) => hex6(t.color_primary ?? "#808080", { dropAlpha: true }));
      const alts = teams.map((t) => t.color_secondary ?? null);
      return {
        league: lg,
        background,
        labels,
        colors,
        alts,
        expected: teamPalette(colors, alts, background, labels),
      };
    }),
  );
  setWarningHandler(null);

  const fixture = {
    about:
      "Shared fixture of sdvplot-js ./deckgl and sdvplot (Python) sdvplot.pydeck: both build these layer props from these rows. Never hand-edit; regenerate with sdvplot-js tools/oracle/deckgl.ts and copy the bytes into both repos.",
    generated_by: `sdvplot-js tools/oracle/deckgl.ts, sdvplot index ${INDEX_VERSION}`,
    warnings,
    inputs: {
      nhl_shots: {
        source:
          "NHL api-web /v1/gamecenter/2023030417/play-by-play (game 7 of the 2024 Stanley Cup Final, Edmonton at Florida), the 27 period-1 shots as sdvplot-js examples/src/data.ts NHL_SHOTS (checked against fixtures/examples/nhl_pbp_2023030417_p1_shots.json); net_x/net_y: the goal at the shot's end, (±89, 0) ft",
        rows: shots,
      },
      france_passes: {
        source:
          "StatsBomb open data, event file 8658 (the 2018 World Cup final), France's 75 completed first-half passes in SPADL coordinates (105 x 68 m) as sdvplot-js examples/src/data.ts WC2018_FINAL_FRANCE_PASSES (checked against fixtures/examples/spadl_8658_france_h1_passes.csv); team: France, ESPN soccer team 478",
        rows: passes,
      },
      marks,
    },
    layers,
    surfaces,
    palettes,
  };
  return `${JSON.stringify(fixture, null, 2)}
`;
}
