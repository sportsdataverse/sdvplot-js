import { resolve } from "node:path";
import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import type { PrismTheme } from "prism-react-renderer";
import remarkLive from "../examples/scripts/remark-live";
import { notebooks } from "./plugins/notebooks";
// Imported, not named by path, so the build cache tracks it: editing this config or a module it imports evicts it.
import sdvExamples from "./plugins/sdv-examples";
import sdvHome from "./plugins/sdv-home";

// This runs in Node.js - no browser APIs here.
//
// The navbar, footer, theme and home page follow sdvplot (Python)'s docs (sportsdataverse/sdvplot docs/), the closest
// sibling: https://sdvplot.sportsdataverse.org. src/css/sdv-theme.css is a byte-for-byte copy of its family theme.

// Preload the two self-hosted faces above the fold: Inter (body) and Barlow Condensed 700 (the page title). The hrefs
// must equal the @font-face urls in src/css/sdv-theme.css or the browser fetches twice.
const fontPreloads = ["inter-latin-wght-normal", "barlow-condensed-latin-700-normal"].map((name) => ({
  tagName: "link",
  attributes: {
    rel: "preload",
    href: `/fonts/${name}.woff2`,
    as: "font",
    type: "font/woff2",
    crossorigin: "anonymous",
  },
}));

// Code-block themes on the family surfaces (white / #111b2e), as sdvplot's: every token colour is a
// sportsdataverse.org token and clears 4.5:1 on its background.
const sdvPrismLight: PrismTheme = {
  plain: { color: "#0e1626", backgroundColor: "#ffffff" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#4d5b74", fontStyle: "italic" } },
    { types: ["punctuation", "operator"], style: { color: "#4d5b74" } },
    { types: ["keyword", "tag", "selector", "atrule", "important"], style: { color: "#02507f" } },
    {
      types: ["string", "char", "attr-value", "regex", "inserted", "triple-quoted-string", "url"],
      style: { color: "#047857" },
    },
    { types: ["number", "boolean", "constant", "symbol", "deleted"], style: { color: "#be123c" } },
    { types: ["function", "class-name", "decorator", "annotation"], style: { color: "#4a3aa7" } },
  ],
};
const sdvPrismDark: PrismTheme = {
  plain: { color: "#e9eef6", backgroundColor: "#111b2e" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#93a1b8", fontStyle: "italic" } },
    { types: ["punctuation", "operator"], style: { color: "#93a1b8" } },
    { types: ["keyword", "tag", "selector", "atrule", "important"], style: { color: "#4fb6e8" } },
    {
      types: ["string", "char", "attr-value", "regex", "inserted", "triple-quoted-string", "url"],
      style: { color: "#10b981" },
    },
    { types: ["number", "boolean", "constant", "symbol", "deleted"], style: { color: "#f0537a" } },
    { types: ["function", "class-name", "decorator", "annotation"], style: { color: "#9085e9" } },
  ],
};

/** An entry of the SDV packages dropdown (`target: "_self"`: the family sites open in place). */
const sdv = (label: string, href: string, header = false) => ({
  label,
  href,
  target: "_self",
  ...(header ? { className: "sdv-section-header" } : {}),
});

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
    ...fontPreloads,
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
          // The Notebooks category (plugins/notebooks.ts) goes right after the generated Gallery.
          async sidebarItemsGenerator({ defaultSidebarItemsGenerator, ...args }) {
            const items = await defaultSidebarItemsGenerator(args);
            if (args.item.dirName !== ".") return items;
            // after the gallery (its _category_.json is written by examples/scripts/pages.ts); last if it is gone
            const at =
              items.findIndex((i) => i.type === "category" && i.label === "Gallery") + 1 || items.length;
            return [...items.slice(0, at), notebooks, ...items.slice(at)];
          },
          remarkPlugins: [
            [remarkLive, { outDir: resolve("../examples/out"), snippetDir: resolve("../examples/snippets") }],
          ],
        },
        blog: false,
        // the shared family theme first, then what only this site needs
        theme: { customCss: ["./src/css/sdv-theme.css", "./src/css/custom.css"] },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    sdvExamples,
    sdvHome,
    // sanitizeComments escapes { } < > outside code in doc comments, so the pages are MDX-safe. sdvplot's open marks
    // inherit Plot's own option docs, and Plot's "a {value, order} object" would otherwise be read as a JSX expression
    // and fail the build.
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
          `${sdvplot}/src/chartjs.ts`,
          `${sdvplot}/src/chartjs-surface.ts`,
          `${sdvplot}/src/plotly.ts`,
          `${sdvplot}/src/vega.ts`,
          `${sdvplot}/src/echarts.ts`,
          `${sdvplot}/src/testing/index.ts`,
          `${sdvplot}/src/export/index.ts`,
          `${sdvplot}/src/interact/index.ts`,
        ],
        tsconfig: `${sdvplot}/tsconfig.json`,
        out: "docs/api/sdvplot",
        sanitizeComments: true,
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
          `${sporty}/src/canvas.ts`,
        ],
        tsconfig: `${sporty}/tsconfig.json`,
        out: "docs/api/sporty",
        sanitizeComments: true,
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
        sanitizeComments: true,
        readme: "none",
      },
    ],
  ],

  themeConfig: {
    image: "img/social-card.png",
    docs: { sidebar: { hideable: true } },
    colorMode: { defaultMode: "light", disableSwitch: false, respectPrefersColorScheme: true },
    metadata: [
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "sdvplot-js | SportsDataverse" },
      { name: "twitter:site", content: "@sportsdataverse" },
      { name: "twitter:creator", content: "@saiemgilani" },
    ],
    navbar: {
      hideOnScroll: true,
      // Navy in both colour modes, like sportsdataverse.org; sdv-theme.css sets the colours.
      style: "dark",
      title: "sdvplot-js",
      logo: { alt: "sdvplot-js hex mark", src: "img/sdvplot-js-mark.svg" },
      items: [
        { type: "docSidebar", sidebarId: "docsSidebar", position: "left", label: "Docs" },
        { to: "/gallery/", label: "Gallery", position: "left" },
        // a static Observable Framework site: pathname:// keeps the SPA router from answering with its 404
        {
          href: "pathname:///notebooks/",
          label: "Notebooks",
          position: "left",
          target: "_self",
          className: "sdv-same-site",
        },
        // SportsDataverse package directory: sdvplot (Python)'s list (sportsdataverse/sdvplot
        // docs/docusaurus.config.ts), itself from https://sportsdataverse.org/packages and
        // https://github.com/sportsdataverse/.github/blob/main/profile/README.md, plus sdvplot-js. Keep it in sync
        // with sdvplot's. The className gives it sdv-theme.css's multi-column mega-menu (custom.css styles the
        // phone drawer's plain list).
        {
          label: "SDV",
          position: "left",
          className: "sdv-packages-dropdown",
          items: [
            sdv("SportsDataverse", "https://sportsdataverse.org", true),
            sdv("Python Packages", "https://py.sportsdataverse.org/", true),
            sdv("sportsdataverse-py", "https://py.sportsdataverse.org/"),
            sdv("sdvplot", "https://sdvplot.sportsdataverse.org/"),
            sdv("sportypy", "https://sportypy.sportsdataverse.org/"),
            sdv("collegebaseball", "https://collegebaseball.readthedocs.io/en/latest/index.html"),
            sdv("nwslpy", "https://github.com/nwslR/nwslpy"),
            sdv("R Packages", "https://r.sportsdataverse.org/", true),
            sdv("sportsdataverse-R", "https://r.sportsdataverse.org/"),
            sdv("sdvplotR", "https://sdvplotR.sportsdataverse.org/"),
            sdv("cfbfastR", "https://cfbfastR.sportsdataverse.org/"),
            sdv("hoopR", "https://hoopR.sportsdataverse.org/"),
            sdv("wehoop", "https://wehoop.sportsdataverse.org/"),
            sdv("fastRhockey", "https://fastRhockey.sportsdataverse.org/"),
            sdv("baseballr", "https://BillPetti.github.io/baseballr/"),
            sdv("sportyR", "https://sportyR.sportsdataverse.org/"),
            sdv("ggshakeR", "https://abhiamishra.github.io/ggshakeR/"),
            sdv("soccerAnimate", "https://github.com/Dato-Futbol/soccerAnimate"),
            sdv("oddsapiR", "https://oddsapiR.sportsdataverse.org/"),
            sdv("mlbplotR", "https://camdenk.github.io/mlbplotR/"),
            sdv("cfbplotR", "https://cfbplotR.sportsdataverse.org/"),
            sdv("cfb4th", "https://cfb4th.sportsdataverse.org/"),
            sdv("cfbseedR", "https://cfbseedR.sportsdataverse.org/"),
            sdv("softballR", "https://github.com/sportsdataverse/softballR/"),
            sdv("nwslR", "https://github.com/nwslR/nwslR/"),
            sdv("usfootballR", "https://usfootballR.sportsdataverse.org/"),
            sdv("recruitR", "https://recruitR.sportsdataverse.org/"),
            sdv("puntr", "https://puntalytics.github.io/puntr/"),
            sdv("chessR", "https://jaseziv.github.io/chessR/"),
            sdv("Node.js Packages", "https://js.sportsdataverse.org/", true),
            sdv("sportsdataverse.js", "https://js.sportsdataverse.org/"),
            sdv("sdvplot-js", "https://plot.sportsdataverse.org/"),
            sdv("nfl-nerd", "https://github.com/nntrn/nfl-nerd/"),
          ],
        },
        { label: "Data status", href: "https://sportsdataverse.org/status", position: "right" },
        { href: "https://github.com/sportsdataverse/sdvplot-js", label: "GitHub", position: "right" },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Getting started", to: "/intro" },
            { label: "Gallery", to: "/gallery/" },
            { label: "Tutorials", to: "/tutorials/" },
            {
              label: "Notebooks",
              href: "pathname:///notebooks/",
              target: "_self",
              className: "sdv-same-site",
            },
            { label: "API reference", to: "/api" },
            { label: "What's covered", to: "/#whats-covered" },
          ],
        },
        {
          title: "Community",
          items: [
            { label: "GitHub", href: "https://github.com/sportsdataverse/sdvplot-js" },
            { label: "Bluesky", href: "https://bsky.app/profile/sportsdataverse.org" },
            { label: "X", href: "https://x.com/SportsDataverse" },
          ],
        },
        {
          title: "SportsDataverse",
          items: [
            { label: "sportsdataverse.org", href: "https://sportsdataverse.org" },
            { label: "sdvplot (Python)", href: "https://sdvplot.sportsdataverse.org" },
            { label: "sdvplotR", href: "https://sdvplotR.sportsdataverse.org" },
            { label: "sportyR", href: "https://sportyR.sportsdataverse.org" },
            { label: "Python packages", href: "https://py.sportsdataverse.org" },
            { label: "R packages", href: "https://r.sportsdataverse.org" },
            { label: "Data status", href: "https://sportsdataverse.org/status" },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} <strong>sdvplot-js</strong>, developed by <a href='https://twitter.com/saiemgilani'>Saiem Gilani</a>, part of the <a href='https://sportsdataverse.org'>SportsDataverse</a>.<br/>Team names, logos and headshots belong to their leagues, teams and other rights holders. sdvplot-js is not affiliated with or endorsed by them; use of each mark follows its owner's terms.`,
    },
    // the family themes defined above: one surface per mode, every token at 4.5:1 or better
    prism: { theme: sdvPrismLight, darkTheme: sdvPrismDark },
  } satisfies Preset.ThemeConfig,
};

export default config;
