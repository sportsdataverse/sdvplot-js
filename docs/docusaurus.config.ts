import { resolve } from "node:path";
import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";
import remarkLive from "../examples/scripts/remark-live";
// Imported, not named by path, so the build cache tracks it: editing this config or a module it imports evicts it.
import sdvExamples from "./plugins/sdv-examples";

// This runs in Node.js - no browser APIs here.

const sdvplot = "../packages/sdvplot";
const sporty = "../packages/sporty";
const sdvtables = "../packages/sdvtables";

const config: Config = {
  title: "sdvplot-js",
  tagline: "Team logos, colours and playing surfaces for Observable Plot and D3",
  favicon: "img/favicon.ico",
  future: { v4: true },

  url: "https://plot.sportsdataverse.org",
  baseUrl: "/",
  organizationName: "sportsdataverse",
  projectName: "sdvplot-js",

  onBrokenLinks: "throw",

  // brand assets from `pnpm brand` (tools/brand/hex-logo.ts)
  headTags: [
    {
      tagName: "link",
      attributes: { rel: "apple-touch-icon", sizes: "180x180", href: "/img/apple-touch-icon.png" },
    },
    {
      tagName: "link",
      attributes: { rel: "icon", type: "image/png", sizes: "192x192", href: "/img/favicon-192.png" },
    },
    {
      tagName: "link",
      attributes: { rel: "icon", type: "image/png", sizes: "512x512", href: "/img/favicon-512.png" },
    },
  ],

  i18n: { defaultLocale: "en", locales: ["en"] },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          remarkPlugins: [
            [remarkLive, { outDir: resolve("../examples/out"), snippetDir: resolve("../examples/snippets") }],
          ],
        },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    sdvExamples,
    [
      "docusaurus-plugin-typedoc",
      {
        id: "sdvplot",
        entryPoints: [
          `${sdvplot}/src/index.ts`,
          `${sdvplot}/src/react/index.tsx`,
          `${sdvplot}/src/plot/index.ts`,
          `${sdvplot}/src/d3/index.ts`,
          `${sdvplot}/src/bins/index.ts`,
          `${sdvplot}/src/shots/index.ts`,
          `${sdvplot}/src/testing/index.ts`,
          `${sdvplot}/src/export/index.ts`,
          `${sdvplot}/src/interact/index.ts`,
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
    [
      "docusaurus-plugin-typedoc",
      {
        id: "sdvtables",
        entryPoints: [
          `${sdvtables}/src/index.ts`,
          `${sdvtables}/src/html/index.ts`,
          `${sdvtables}/src/react/index.tsx`,
          `${sdvtables}/src/export/index.ts`,
        ],
        tsconfig: `${sdvtables}/tsconfig.json`,
        out: "docs/api/sdvtables",
        readme: "none",
      },
    ],
  ],

  themeConfig: {
    image: "img/social-card.png",
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: "sdvplot-js",
      logo: { alt: "sdvplot-js hex mark", src: "img/sdvplot-js-mark.svg" },
      items: [
        { type: "docSidebar", sidebarId: "docsSidebar", position: "left", label: "Docs" },
        { to: "/gallery/", label: "Gallery", position: "left" },
        { href: "pathname:///notebooks/", label: "Notebooks", position: "left" },
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
