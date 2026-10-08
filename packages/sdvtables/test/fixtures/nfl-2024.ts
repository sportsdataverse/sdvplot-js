// test/fixtures/nfl-2024.ts
// All 32 teams of the 2024 NFL regular season (nflverse), in the Standing shape: W/L/T, PF/PA, result_last (the week
// 18 result) and qb (the most frequent starter, as games.csv credits starts) from nfl_games_2024_reg.csv; qb_espn_id
// from nfl_qb_espn_ids_2024.csv; net_epa = offensive minus defensive EPA per rush or pass play from
// nfl_epa_2024_reg.csv; srs_rank from the Simple Rating System over all 272 games; conf and division from
// nfl_divisions.csv (nflseedR::divisions). Sources and provenance: nfl-2024/README.md. test/nfl-2024.test.ts re-derives
// every value from those files. Values as the sources serve them; nothing is invented or hand-edited.
import type { Standing } from "./standings.js";
export const NFL_2024: readonly Standing[] = [
  { team: "ARI", conf: "NFC", division: "West",  wins: 8,  losses: 9,  ties: 0, pf: 400, pa: 379, net_epa:  0.017, srs_rank: 12, qb: "Kyler Murray",        qb_espn_id: "3917315", result_last: "W" },
  { team: "ATL", conf: "NFC", division: "South", wins: 8,  losses: 9,  ties: 0, pf: 389, pa: 423, net_epa: -0.003, srs_rank: 19, qb: "Kirk Cousins",        qb_espn_id: "14880",   result_last: "L" },
  { team: "BAL", conf: "AFC", division: "North", wins: 12, losses: 5,  ties: 0, pf: 518, pa: 361, net_epa:  0.215, srs_rank: 2,  qb: "Lamar Jackson",       qb_espn_id: "3916387", result_last: "W" },
  { team: "BUF", conf: "AFC", division: "East",  wins: 13, losses: 4,  ties: 0, pf: 525, pa: 368, net_epa:  0.190, srs_rank: 4,  qb: "Josh Allen",          qb_espn_id: "3918298", result_last: "L" },
  { team: "CAR", conf: "NFC", division: "South", wins: 5,  losses: 12, ties: 0, pf: 341, pa: 534, net_epa: -0.195, srs_rank: 32, qb: "Andy Dalton",         qb_espn_id: "14012",   result_last: "W" },
  { team: "CHI", conf: "NFC", division: "North", wins: 5,  losses: 12, ties: 0, pf: 310, pa: 370, net_epa: -0.073, srs_rank: 20, qb: "Caleb Williams",      qb_espn_id: "4431611", result_last: "W" },
  { team: "CIN", conf: "AFC", division: "North", wins: 9,  losses: 8,  ties: 0, pf: 472, pa: 434, net_epa:  0.052, srs_rank: 15, qb: "Joe Burrow",          qb_espn_id: "3915511", result_last: "W" },
  { team: "CLE", conf: "AFC", division: "North", wins: 3,  losses: 14, ties: 0, pf: 258, pa: 435, net_epa: -0.193, srs_rank: 31, qb: "Jameis Winston",      qb_espn_id: "2969939", result_last: "L" },
  { team: "DAL", conf: "NFC", division: "East",  wins: 7,  losses: 10, ties: 0, pf: 350, pa: 468, net_epa: -0.157, srs_rank: 25, qb: "Dak Prescott",        qb_espn_id: "2577417", result_last: "L" },
  { team: "DEN", conf: "AFC", division: "West",  wins: 10, losses: 7,  ties: 0, pf: 425, pa: 311, net_epa:  0.108, srs_rank: 8,  qb: "Bo Nix",              qb_espn_id: "4426338", result_last: "W" },
  { team: "DET", conf: "NFC", division: "North", wins: 15, losses: 2,  ties: 0, pf: 564, pa: 342, net_epa:  0.200, srs_rank: 1,  qb: "Jared Goff",          qb_espn_id: "3046779", result_last: "W" },
  { team: "GB",  conf: "NFC", division: "North", wins: 11, losses: 6,  ties: 0, pf: 460, pa: 338, net_epa:  0.148, srs_rank: 3,  qb: "Jordan Love",         qb_espn_id: "4036378", result_last: "L" },
  { team: "HOU", conf: "AFC", division: "South", wins: 10, losses: 7,  ties: 0, pf: 372, pa: 372, net_epa:  0.014, srs_rank: 17, qb: "C.J. Stroud",         qb_espn_id: "4432577", result_last: "W" },
  { team: "IND", conf: "AFC", division: "South", wins: 8,  losses: 9,  ties: 0, pf: 377, pa: 427, net_epa: -0.053, srs_rank: 22, qb: "Joe Flacco",          qb_espn_id: "11252",   result_last: "W" },
  { team: "JAX", conf: "AFC", division: "South", wins: 4,  losses: 13, ties: 0, pf: 320, pa: 435, net_epa: -0.149, srs_rank: 27, qb: "Trevor Lawrence",     qb_espn_id: "4360310", result_last: "L" },
  { team: "KC",  conf: "AFC", division: "West",  wins: 15, losses: 2,  ties: 0, pf: 385, pa: 326, net_epa:  0.063, srs_rank: 10, qb: "Patrick Mahomes",     qb_espn_id: "3139477", result_last: "L" },
  { team: "LA",  conf: "NFC", division: "West",  wins: 10, losses: 7,  ties: 0, pf: 367, pa: 386, net_epa: -0.016, srs_rank: 16, qb: "Matthew Stafford",    qb_espn_id: "12483",   result_last: "L" },
  { team: "LAC", conf: "AFC", division: "West",  wins: 11, losses: 6,  ties: 0, pf: 402, pa: 301, net_epa:  0.101, srs_rank: 9,  qb: "Justin Herbert",      qb_espn_id: "4038941", result_last: "W" },
  { team: "LV",  conf: "AFC", division: "West",  wins: 4,  losses: 13, ties: 0, pf: 309, pa: 434, net_epa: -0.146, srs_rank: 26, qb: "Gardner Minshew",     qb_espn_id: "4038524", result_last: "L" },
  { team: "MIA", conf: "AFC", division: "East",  wins: 8,  losses: 9,  ties: 0, pf: 345, pa: 364, net_epa: -0.019, srs_rank: 21, qb: "Tua Tagovailoa",      qb_espn_id: "4241479", result_last: "L" },
  { team: "MIN", conf: "NFC", division: "North", wins: 14, losses: 3,  ties: 0, pf: 432, pa: 332, net_epa:  0.126, srs_rank: 7,  qb: "Sam Darnold",         qb_espn_id: "3912547", result_last: "L" },
  { team: "NE",  conf: "AFC", division: "East",  wins: 4,  losses: 13, ties: 0, pf: 289, pa: 417, net_epa: -0.162, srs_rank: 29, qb: "Drake Maye",          qb_espn_id: "4431452", result_last: "W" },
  { team: "NO",  conf: "NFC", division: "South", wins: 5,  losses: 12, ties: 0, pf: 338, pa: 398, net_epa: -0.094, srs_rank: 23, qb: "Derek Carr",          qb_espn_id: "16757",   result_last: "L" },
  { team: "NYG", conf: "NFC", division: "East",  wins: 3,  losses: 14, ties: 0, pf: 273, pa: 415, net_epa: -0.162, srs_rank: 28, qb: "Daniel Jones",        qb_espn_id: "3917792", result_last: "L" },
  { team: "NYJ", conf: "AFC", division: "East",  wins: 5,  losses: 12, ties: 0, pf: 338, pa: 404, net_epa: -0.045, srs_rank: 24, qb: "Aaron Rodgers",       qb_espn_id: "8439",    result_last: "W" },
  { team: "PHI", conf: "NFC", division: "East",  wins: 14, losses: 3,  ties: 0, pf: 463, pa: 303, net_epa:  0.196, srs_rank: 5,  qb: "Jalen Hurts",         qb_espn_id: "4040715", result_last: "W" },
  { team: "PIT", conf: "AFC", division: "North", wins: 10, losses: 7,  ties: 0, pf: 380, pa: 347, net_epa: -0.008, srs_rank: 13, qb: "Russell Wilson",      qb_espn_id: "14881",   result_last: "L" },
  { team: "SEA", conf: "NFC", division: "West",  wins: 10, losses: 7,  ties: 0, pf: 375, pa: 368, net_epa:  0.003, srs_rank: 14, qb: "Geno Smith",          qb_espn_id: "15864",   result_last: "W" },
  { team: "SF",  conf: "NFC", division: "West",  wins: 6,  losses: 11, ties: 0, pf: 389, pa: 436, net_epa:  0.009, srs_rank: 18, qb: "Brock Purdy",         qb_espn_id: "4361741", result_last: "L" },
  { team: "TB",  conf: "NFC", division: "South", wins: 10, losses: 7,  ties: 0, pf: 502, pa: 385, net_epa:  0.115, srs_rank: 6,  qb: "Baker Mayfield",      qb_espn_id: "3052587", result_last: "W" },
  { team: "TEN", conf: "AFC", division: "South", wins: 3,  losses: 14, ties: 0, pf: 311, pa: 460, net_epa: -0.151, srs_rank: 30, qb: "Mason Rudolph",       qb_espn_id: "3116407", result_last: "L" },
  { team: "WAS", conf: "NFC", division: "East",  wins: 12, losses: 5,  ties: 0, pf: 485, pa: 391, net_epa:  0.096, srs_rank: 11, qb: "Jayden Daniels",      qb_espn_id: "4426348", result_last: "W" },
];
