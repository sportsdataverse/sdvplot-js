import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { usePluginData } from "@docusaurus/useGlobalData";
import CodeBlock from "@theme/CodeBlock";
import Heading from "@theme/Heading";
import Layout from "@theme/Layout";
import type { ReactNode } from "react";
import type { Badge, HomeData } from "../../plugins/sdv-home";
import Coverage from "../components/Coverage";

// The home page follows sdvplot (Python)'s (https://sdvplot.sportsdataverse.org): hero, install, what it covers, a
// card per concept. The coverage numbers and the badge row (the root README's) are read at build time
// (docs/plugins/sdv-home.ts).

const FEATURES: readonly { title: string; to: string; body: ReactNode }[] = [
  {
    title: "Any identifier",
    to: "/guides/identity",
    body: (
      <>
        An abbreviation, an ESPN id, a full name or a relocated franchise's old code: <code>resolve()</code>{" "}
        turns it into one stable team id, season-aware, and never guesses.
      </>
    ),
  },
  {
    title: "Logos, wordmarks, headshots",
    to: "/guides/marks",
    body: (
      <>
        Marks for every era from the SportsDataverse logo archive, and player headshots by ESPN or league id.
      </>
    ),
  },
  {
    title: "Team colours",
    to: "/guides/colors",
    body: (
      <>
        <code>teamColors()</code>, <code>palette()</code> and matchup colours that keep two teams apart, with
        WCAG contrast helpers.
      </>
    ),
  },
  {
    title: "Playing surfaces",
    to: "/guides/surfaces",
    body: <>Courts, rinks, fields and pitches from sporty, in SVG, canvas, Observable Plot or D3.</>,
  },
  {
    title: "Tables",
    to: "/guides/tables",
    body: (
      <>
        sdvtables: a plain-data spec with logo, colour and bar cells, themes, and HTML, React or PNG output.
      </>
    ),
  },
  {
    title: "Your chart library",
    to: "/guides/chart-libraries",
    body: (
      <>
        Observable Plot, D3 and React, plus adapters for Plotly, Vega-Lite, ECharts and Chart.js. Node and SSR
        too.
      </>
    ),
  },
];

function Hero(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className="hero hero--primary sdv-home-hero">
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className="sdv-home-buttons">
          <Link className="button button--secondary button--lg" to="/intro">
            Getting started
          </Link>
          <Link className="button button--outline button--secondary button--lg" to="/gallery/">
            Gallery
          </Link>
          <Link className="button button--outline button--secondary button--lg" to="/api">
            API reference
          </Link>
        </div>
      </div>
    </header>
  );
}

function Badges({ badges }: { badges: readonly Badge[] }): ReactNode {
  return (
    <ul className="sdv-home-badges" aria-label="Package status">
      {badges.map((b) => (
        <li key={b.src}>
          <a href={b.href}>
            <img src={b.src} alt={b.alt} height={28} loading="lazy" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  const { coverage, badges } = usePluginData("sdv-home") as HomeData;
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <Hero />
      <main>
        <section className="sdv-home-section">
          <div className="container">
            <Badges badges={badges} />
            <h2>Install</h2>
            <CodeBlock language="sh">
              pnpm add @sportsdataverse/sdvplot @sportsdataverse/sporty @sportsdataverse/sdvtables
              @observablehq/plot
            </CodeBlock>
            <p>
              The chart libraries are optional peers: install the one you draw with.{" "}
              <Link to="/intro">Getting started</Link> lists every entry point; the{" "}
              <Link to="/gallery/">gallery</Link> shows every example, each run in CI before it is published.
            </p>
          </div>
        </section>
        <section className="sdv-home-section">
          <div className="container">
            <Heading as="h2" id="whats-covered">
              What's covered
            </Heading>
            <Coverage data={coverage} />
          </div>
        </section>
        <section className="sdv-home-features">
          <div className="container">
            <div className="row">
              {FEATURES.map((f) => (
                <div key={f.title} className="col col--4 sdv-home-feature">
                  <div className="card sdv-home-card">
                    <h3 className="sdv-home-card-title">
                      <Link to={f.to}>{f.title}</Link>
                    </h3>
                    <p>{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
