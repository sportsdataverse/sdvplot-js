// test/fixtures/standings.ts
// Eight 2024 AFC teams (West and East), every value from the 2024 regular season: W/L/T, PF/PA, result_last (the week
// 18 result) and qb (the most frequent starter) from nflverse games.csv; qb_espn_id from nflverse players.csv; srs_rank
// from the Simple Rating System (least squares on every game's margin, ratings summing to zero) over all 272 games;
// net_epa = offensive minus defensive EPA per rush or pass play, nflverse play_by_play_2024. New England's net_epa is
// blanked on purpose, so tables show a missing value. examples/test/sample-data.test.ts re-derives every value from
// fixtures/examples (written by tools/sample-data/nfl_2024.py).
export interface Standing { team: string; conf: "AFC" | "NFC"; division: string; wins: number; losses: number; ties: number; pf: number; pa: number; net_epa: number | null; srs_rank: number; qb: string; qb_espn_id: string; result_last: "W" | "L" | "T"; }
export const STANDINGS: readonly Standing[] = [
  { team: "KC",  conf: "AFC", division: "West", wins: 15, losses: 2, ties: 0, pf: 385, pa: 326, net_epa:  0.063, srs_rank: 10, qb: "Patrick Mahomes", qb_espn_id: "3139477", result_last: "L" },
  { team: "LAC", conf: "AFC", division: "West", wins: 11, losses: 6, ties: 0, pf: 402, pa: 301, net_epa:  0.101, srs_rank: 9,  qb: "Justin Herbert",  qb_espn_id: "4038941", result_last: "W" },
  { team: "DEN", conf: "AFC", division: "West", wins: 10, losses: 7, ties: 0, pf: 425, pa: 311, net_epa:  0.108, srs_rank: 8,  qb: "Bo Nix",          qb_espn_id: "4426338", result_last: "W" },
  { team: "LV",  conf: "AFC", division: "West", wins: 4,  losses: 13, ties: 0, pf: 309, pa: 434, net_epa: -0.146, srs_rank: 26, qb: "Gardner Minshew", qb_espn_id: "4038524", result_last: "L" },
  { team: "BUF", conf: "AFC", division: "East", wins: 13, losses: 4, ties: 0, pf: 525, pa: 368, net_epa:  0.190, srs_rank: 4,  qb: "Josh Allen",      qb_espn_id: "3918298", result_last: "L" },
  { team: "MIA", conf: "AFC", division: "East", wins: 8,  losses: 9, ties: 0, pf: 345, pa: 364, net_epa: -0.019, srs_rank: 21, qb: "Tua Tagovailoa",  qb_espn_id: "4241479", result_last: "L" },
  { team: "NYJ", conf: "AFC", division: "East", wins: 5,  losses: 12, ties: 0, pf: 338, pa: 404, net_epa: -0.045, srs_rank: 24, qb: "Aaron Rodgers",   qb_espn_id: "8439",    result_last: "W" },
  { team: "NE",  conf: "AFC", division: "East", wins: 4,  losses: 13, ties: 0, pf: 289, pa: 417, net_epa: null,   srs_rank: 29, qb: "Drake Maye",      qb_espn_id: "4431452", result_last: "W" },
];
