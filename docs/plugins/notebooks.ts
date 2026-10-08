// The notebook list has ONE home: the `pages` of the Observable Framework config. A page added there shows up in
// this sidebar on the next build; nothing in the docs needs editing.
import notebooksConfig from "../../notebooks/observablehq.config.js";

type Link = { type: "link"; label: string; href: string };
/** Framework's `pages`: a page, or a section holding pages (and, optionally, a page of its own). */
type NotebookPage = {
  readonly name: string;
  readonly path?: string;
  readonly pages?: readonly NotebookPage[];
};

/**
 * A notebook is a static page, not a Docusaurus route: `pathname://` makes the link a plain <a href>, so the
 * browser loads /notebooks/<page>.html instead of the SPA router showing its 404. Framework writes `<path>.html`
 * (`preserveExtension: true` in observablehq.config.js).
 */
const link = (label: string, path: string): Link => ({
  type: "link",
  label,
  href: path === "/" ? "pathname:///notebooks/" : `pathname:///notebooks${path}.html`,
});
const items = (pages: readonly NotebookPage[]): Link[] =>
  pages.flatMap((p) => [...(p.path ? [link(p.name, p.path)] : []), ...items(p.pages ?? [])]);

/** The Observable Framework notebooks; docusaurus.config.ts places this category after the generated Gallery. */
export const notebooks = {
  type: "category" as const,
  label: "Notebooks",
  collapsed: false,
  items: [link("All notebooks", "/"), ...items(notebooksConfig.pages as readonly NotebookPage[])],
};
