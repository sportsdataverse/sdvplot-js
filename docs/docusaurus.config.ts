import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

// This runs in Node.js - no browser APIs here.

const sdvplot = "../packages/sdvplot";
const sporty = "../packages/sporty";

const config: Config = {
  title: "sdvplot-js",
  tagline: "Team logos, colours and playing surfaces for Observable Plot and D3",
  favicon: "img/favicon.ico",
  future: { v4: true },

  url: "https://plot.sportsdataverse.org", // owner: confirm host
  baseUrl: "/",
  organizationName: "sportsdataverse",
  projectName: "sdvplot-js",

  onBrokenLinks: "throw",

  i18n: { defaultLocale: "en", locales: ["en"] },

  presets: [
    [
      "classic",
      {
        docs: { sidebarPath: "./sidebars.ts", routeBasePath: "/" },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      "docusaurus-plugin-typedoc",
      {
        id: "sdvplot",
        entryPoints: [
          `${sdvplot}/src/index.ts`,
          `${sdvplot}/src/react/index.tsx`,
          `${sdvplot}/src/plot/index.ts`,
          `${sdvplot}/src/d3/index.ts`,
          `${sdvplot}/src/testing/index.ts`,
        ],
        tsconfig: `${sdvplot}/tsconfig.json`,
        out: "docs/api/sdvplot",
        readme: "none",
      },
    ],
    [
      "docusaurus-plugin-typedoc",
      {
        id: "sporty",
        entryPoints: [
          `${sporty}/src/index.ts`,
          `${sporty}/src/svg.ts`,
          `${sporty}/src/specs/index.ts`,
          `${sporty}/src/plot.ts`,
          `${sporty}/src/d3.ts`,
        ],
        tsconfig: `${sporty}/tsconfig.json`,
        out: "docs/api/sporty",
        readme: "none",
      },
    ],
  ],

  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: "sdvplot-js",
      items: [
        { type: "docSidebar", sidebarId: "docsSidebar", position: "left", label: "Docs" },
        { href: "https://github.com/sportsdataverse/sdvplot-js", label: "GitHub", position: "right" },
      ],
    },
    footer: {
      style: "dark",
      copyright: `Copyright © ${new Date().getFullYear()} SportsDataverse. Built with Docusaurus.`,
    },
    prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula },
  } satisfies Preset.ThemeConfig,
};

export default config;
