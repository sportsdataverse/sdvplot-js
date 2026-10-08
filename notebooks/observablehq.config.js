const SOURCE = "https://github.com/sportsdataverse/sdvplot-js/blob/main/notebooks/src";

export default {
  title: "sdvplot-js notebooks",
  root: "src",
  base: "/notebooks/",
  // Links name the .html file (Framework defaults to extensionless links): the docs deploy (Vercel, no vercel.json)
  // serves /notebooks/logos.html, not /notebooks/logos.
  preserveExtension: true,
  pages: [
    { name: "Logos by league", path: "/logos" },
    { name: "Team colours", path: "/colors" },
    { name: "Playing surfaces", path: "/surfaces" },
    { name: "Table themes", path: "/tables" },
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
};
