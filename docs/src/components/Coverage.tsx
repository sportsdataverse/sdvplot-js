import Link from "@docusaurus/Link";
import Heading from "@theme/Heading";
import type { ReactNode } from "react";
import type { Coverage as Data, LeagueCoverage } from "../../plugins/sdv-home";

/**
 * Display names and groups for sdvplot's league ids. Presentation only: the rows and every number come from the
 * index (docs/plugins/sdv-home.ts), and a league missing here still renders, under "Other leagues", by its id.
 */
const LEAGUE_NAMES: Readonly<Record<string, readonly [group: string, name: string]>> = {
  nfl: ["Football", "NFL"],
  cfb: ["Football", "College football"],
  ufl: ["Football", "UFL"],
  xfl: ["Football", "XFL"],
  usfl: ["Football", "USFL"],
  aaf: ["Football", "Alliance of American Football"],
  nba: ["Basketball", "NBA"],
  wnba: ["Basketball", "WNBA"],
  nbagl: ["Basketball", "NBA G League"],
  mbb: ["Basketball", "Men's college basketball"],
  wbb: ["Basketball", "Women's college basketball"],
  mlb: ["Baseball and softball", "MLB"],
  milb: ["Baseball and softball", "Minor League Baseball"],
  ncaa_baseball: ["Baseball and softball", "College baseball"],
  ncaa_softball: ["Baseball and softball", "College softball"],
  nhl: ["Hockey", "NHL"],
  pwhl: ["Hockey", "PWHL"],
  ahl: ["Hockey", "AHL"],
  echl: ["Hockey", "ECHL"],
  ohl: ["Hockey", "OHL"],
  whl: ["Hockey", "WHL"],
  qmjhl: ["Hockey", "QMJHL"],
  ushl: ["Hockey", "USHL"],
  phf: ["Hockey", "Premier Hockey Federation"],
  ncaa_mhockey: ["Hockey", "Men's college hockey"],
  ncaa_whockey: ["Hockey", "Women's college hockey"],
  soccer: ["Soccer", "Soccer clubs"],
  cricket: ["Cricket", "Cricket teams"],
};
const OTHER = "Other leagues";
const HEADSHOT_LABELS: Readonly<Record<string, string>> = {
  espn: "ESPN",
  gsis: "gsis",
  league: "league ids",
};
/** The page that draws each sport's surfaces; the rest are in the surfaces guide. */
const SPORT_PAGES: Readonly<Record<string, string>> = {
  basketball: "/examples/basketball",
  football: "/examples/football",
  hockey: "/examples/hockey",
};

const fmt = (n: number): string => n.toLocaleString("en-US");
const title = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** An empty cell: a dash to the eye, "none" to a screen reader. */
const None = (): ReactNode => (
  <>
    <span aria-hidden="true">—</span>
    <span className="sdv-sr-only">none</span>
  </>
);

function Count({ col, n }: { col: string; n: number }): ReactNode {
  return (
    <td data-col={col} data-value={n} className="sdv-cov-num">
      {n === 0 ? <None /> : fmt(n)}
    </td>
  );
}

function LeagueRow({ l }: { l: LeagueCoverage }): ReactNode {
  return (
    <tr data-league={l.league}>
      <th scope="row">
        <code className="sdv-chip">{l.league}</code>{" "}
        <span className="sdv-cov-name">{LEAGUE_NAMES[l.league]?.[1]}</span>
      </th>
      <Count col="teams" n={l.teams} />
      <Count col="colors" n={l.colors} />
      <Count col="logos" n={l.logos} />
      <Count col="wordmarks" n={l.wordmarks} />
      <td data-col="aliases" data-value={l.aliases} className="sdv-cov-num">
        {fmt(l.aliases)} <span className="sdv-cov-sub">({l.idSystems} id systems)</span>
      </td>
      <td data-col="headshots" data-value={l.headshots.join(" ")}>
        {l.headshots.length === 0 ? (
          <None />
        ) : (
          l.headshots.map((h) => (
            <span key={h} className="sdv-chip sdv-chip--soft">
              {HEADSHOT_LABELS[h] ?? h}
            </span>
          ))
        )}
      </td>
    </tr>
  );
}

/** sdvplot's leagues × resources, sporty's sports × leagues, and where the data comes from. */
export default function Coverage({ data }: { data: Data }): ReactNode {
  const groups = new Map<string, LeagueCoverage[]>();
  for (const [group] of Object.values(LEAGUE_NAMES)) groups.set(group, []);
  groups.set(OTHER, []);
  const order = Object.keys(LEAGUE_NAMES);
  const rank = (l: LeagueCoverage): number =>
    order.includes(l.league) ? order.indexOf(l.league) : order.length;
  for (const l of [...data.leagues].sort((a, b) => rank(a) - rank(b)))
    groups.get(LEAGUE_NAMES[l.league]?.[0] ?? OTHER)?.push(l);
  const teams = data.leagues.reduce((s, l) => s + l.teams, 0);
  const surfaceLeagues = data.sports.reduce((s, x) => s + x.leagues.length, 0);
  const tally = (r: Readonly<Record<string, number>>): string =>
    Object.entries(r)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${fmt(n)}`)
      .join(" · ");
  return (
    <div className="sdv-coverage">
      <p className="sdv-cov-totals" data-totals>
        <strong>{data.leagues.length}</strong> leagues and <strong>{fmt(teams)}</strong> teams in sdvplot;{" "}
        <strong>{data.sports.length}</strong> sports and <strong>{surfaceLeagues}</strong> league surfaces in
        sporty.
      </p>

      <Heading as="h3" id="leagues">
        Leagues and resources (sdvplot)
      </Heading>
      <p>
        Teams per league with each resource. Browse them in the{" "}
        <Link to="pathname:///notebooks/logos.html">Logos by league</Link> and{" "}
        <Link to="pathname:///notebooks/colors.html">Team colours</Link> notebooks.
      </p>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be reachable by keyboard */}
      <section className="sdv-cov-scroll" aria-label="Leagues and resources" tabIndex={0}>
        <table className="sdv-cov-table">
          <thead>
            <tr>
              <th scope="col">League</th>
              <th scope="col" className="sdv-cov-num">
                <Link to="/guides/identity">Teams</Link>
              </th>
              <th scope="col" className="sdv-cov-num">
                <Link to="/guides/colors">Colours</Link>
              </th>
              <th scope="col" className="sdv-cov-num">
                <Link to="/guides/marks">Logos</Link>
              </th>
              <th scope="col" className="sdv-cov-num">
                <Link to="/guides/marks">Wordmarks</Link>
              </th>
              <th scope="col" className="sdv-cov-num">
                <Link to="/guides/identity">Aliases</Link>
              </th>
              <th scope="col">
                <Link to="/guides/marks">Headshots</Link>
              </th>
            </tr>
          </thead>
          {[...groups].map(([group, rows]) =>
            rows.length === 0 ? null : (
              <tbody key={group}>
                <tr className="sdv-cov-group">
                  <th scope="colgroup" colSpan={7}>
                    {group}
                  </th>
                </tr>
                {rows.map((l) => (
                  <LeagueRow key={l.league} l={l} />
                ))}
              </tbody>
            ),
          )}
        </table>
      </section>

      <Heading as="h3" id="surfaces">
        Playing surfaces (sporty)
      </Heading>
      <p>
        Every sport <code>surface()</code> draws and the leagues it knows; <code>custom</code> takes your own
        dimensions. See the <Link to="/guides/surfaces">surfaces guide</Link> and the{" "}
        <Link to="pathname:///notebooks/surfaces.html">Playing surfaces</Link> notebook.
      </p>
      <ul className="sdv-cov-sports">
        {data.sports.map((s) => (
          <li key={s.sport} data-sport={s.sport} className="sdv-cov-sport">
            <Link className="sdv-cov-sport-name" to={SPORT_PAGES[s.sport] ?? "/guides/surfaces"}>
              {title(s.sport)}
            </Link>
            <ul className="sdv-chips">
              {s.leagues.map((l) => (
                <li key={l} className="sdv-chip" data-league={l}>
                  {l}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <Heading as="h3" id="sources">
        Data sources and provenance
      </Heading>
      <dl className="sdv-cov-sources">
        <dt>Team index</dt>
        <dd>
          Curated in <Link to="https://sdvplot.sportsdataverse.org">sdvplot</Link> (Python, MIT) and bundled
          here, one chunk per league: index <code>{data.indexVersion}</code>. Nothing is downloaded to resolve
          a team.
        </dd>
        <dt>Logos and wordmarks</dt>
        <dd>
          The SportsDataverse logo archive: content-addressed files on <code>{data.archiveHost}</code>,
          manifest of {data.manifestDate}. Marks by source: {tally(data.markSources)}.
        </dd>
        <dt>Team colours</dt>
        <dd>Teams by colour source: {tally(data.colorSources)}.</dd>
        <dt>Headshots</dt>
        <dd>
          ESPN's image CDN by athlete id (
          {data.leagues
            .filter((l) => l.headshots.includes("espn"))
            .map((l) => l.league)
            .join(", ")}
          ); the leagues' own CDNs by league player id (
          {data.leagues
            .filter((l) => l.headshots.includes("league"))
            .map((l) => l.league)
            .join(", ")}
          ); NFL gsis ids through nflverse's players table. URLs only: no image is bundled.
        </dd>
        <dt>nflverse</dt>
        <dd>
          The gsis map, the NFL colours and the <code>nflverse</code> aliases derive from{" "}
          <Link to="https://github.com/nflverse/nflverse-data">nflverse-data</Link>, licensed{" "}
          <Link to="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</Link> (see{" "}
          <Link to="https://github.com/sportsdataverse/sdvplot-js/blob/main/NOTICE.md">NOTICE</Link>).
        </dd>
        <dt>Surface dimensions</dt>
        <dd>
          Ported from <Link to="https://sportyR.sportsdataverse.org">sportyR</Link> (Ross Drucker) and{" "}
          <Link to="https://sportypy.sportsdataverse.org">sportypy</Link>, distributed under MIT by agreement
          of the SportsDataverse maintainers.
        </dd>
      </dl>
    </div>
  );
}
