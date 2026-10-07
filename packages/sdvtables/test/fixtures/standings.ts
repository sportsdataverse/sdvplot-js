// test/fixtures/standings.ts
export interface Standing { team: string; conf: "AFC" | "NFC"; division: string; wins: number; losses: number; ties: number; pf: number; pa: number; net_epa: number | null; srs_rank: number; qb: string; qb_espn_id: string; result_last: "W" | "L" | "T"; }
export const STANDINGS: readonly Standing[] = [
  { team: "KC",  conf: "AFC", division: "West", wins: 15, losses: 2, ties: 0, pf: 385, pa: 326, net_epa:  0.071, srs_rank: 9,  qb: "Patrick Mahomes", qb_espn_id: "3139477", result_last: "L" },
  { team: "LAC", conf: "AFC", division: "West", wins: 11, losses: 6, ties: 0, pf: 402, pa: 301, net_epa:  0.083, srs_rank: 5,  qb: "Justin Herbert",  qb_espn_id: "4038941", result_last: "L" },
  { team: "DEN", conf: "AFC", division: "West", wins: 10, losses: 7, ties: 0, pf: 425, pa: 311, net_epa:  0.064, srs_rank: 6,  qb: "Bo Nix",          qb_espn_id: "4426338", result_last: "L" },
  { team: "LV",  conf: "AFC", division: "West", wins: 4,  losses: 13, ties: 0, pf: 309, pa: 434, net_epa: -0.128, srs_rank: 30, qb: "Aidan O'Connell", qb_espn_id: "4361418", result_last: "W" },
  { team: "BUF", conf: "AFC", division: "East", wins: 13, losses: 4, ties: 0, pf: 525, pa: 368, net_epa:  0.191, srs_rank: 2,  qb: "Josh Allen",      qb_espn_id: "3918298", result_last: "L" },
  { team: "MIA", conf: "AFC", division: "East", wins: 8,  losses: 9, ties: 0, pf: 345, pa: 364, net_epa: -0.012, srs_rank: 17, qb: "Tua Tagovailoa",  qb_espn_id: "4241479", result_last: "W" },
  { team: "NYJ", conf: "AFC", division: "East", wins: 5,  losses: 12, ties: 0, pf: 338, pa: 404, net_epa: -0.071, srs_rank: 25, qb: "Aaron Rodgers",   qb_espn_id: "8439",    result_last: "L" },
  { team: "NE",  conf: "AFC", division: "East", wins: 4,  losses: 13, ties: 0, pf: 289, pa: 417, net_epa: null,   srs_rank: 31, qb: "Drake Maye",      qb_espn_id: "4431452", result_last: "W" },
];
