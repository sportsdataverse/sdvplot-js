const SOURCE = "https://github.com/sportsdataverse/sdvplot-js/blob/main/notebooks/src";

export default {
  title: "sdvplot-js notebooks",
  root: "src",
  base: "/notebooks/",
  // Links name the .html file (Framework defaults to extensionless links): the docs deploy (Vercel, no vercel.json)
  // serves /notebooks/logos.html, not /notebooks/logos.
  preserveExtension: true,
  // The index groups the pages the same way (src/index.md).
  pages: [
    {
      name: "Identity",
      pages: [
        { name: "Logos by league", path: "/logos" },
        { name: "Team colours", path: "/colors" },
      ],
    },
    { name: "Surfaces", pages: [{ name: "Playing surfaces", path: "/surfaces" }] },
    { name: "Shot charts", pages: [{ name: "Shot charts", path: "/shots" }] },
    { name: "Tables", pages: [{ name: "Tables", path: "/tables" }] },
    { name: "Linking", pages: [{ name: "Linked interactivity", path: "/linked" }] },
    { name: "Chart libraries", pages: [{ name: "Chart libraries", path: "/libraries" }] },
    // ESPN data through sportsdataverse-js (snapshots in fixtures/sdvjs, a "Fetch live" toggle on each page)
    {
      name: "Workflows with sdv-js",
      pages: [
        { name: "Live scoreboard", path: "/scoreboard" },
        { name: "Win-probability scrubber", path: "/win-probability" },
        { name: "Build your own game dashboard", path: "/game-dashboard" },
        { name: "Season ratings scatter", path: "/ratings" },
        { name: "Player trend explorer", path: "/player-trend" },
      ],
    },
  ],
  // rel="external": Framework rewrites a root link into its own base ("/" would become /notebooks/).
  // "Open in Observable" once a page names its observablehq.com twin (owner step after the 0.1.0 publish).
  header: ({ data, path }) =>
    `<a href="/" rel="external">sdvplot-js docs</a> · ${
      data?.observable
        ? `<a href="${data.observable}">Open in Observable</a>`
        : `<a href="${SOURCE}${path === "/" ? "/index" : path}.md">View source</a>`
    }`,
  footer: "Built with Observable Framework from the sdvplot-js repository.",
  // Framework's global table rules (td { color }, table { font }, a border under each tr) outrank what an sdvtables
  // table inherits from its own root, so in dark mode its cells took the page's light text on the table's white
  // background. Give the table back its own text colour, font and rules.
  head: "<style>.sdvt td{color:inherit}.sdvt table{font:inherit}.sdvt tr{border-bottom:0}</style>",
};
