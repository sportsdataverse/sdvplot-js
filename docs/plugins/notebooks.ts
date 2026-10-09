// The notebook list has ONE home: the `pages` of the Observable Framework config. A page added there shows up in
// this sidebar on the next build; nothing in the docs needs editing.
import notebooksConfig from "../../notebooks/observablehq.config.js";

type Link = { type: "link"; label: string; href: string };
type Category = { type: "category"; label: string; collapsed: boolean; items: Item[] };
type Item = Link | Category;
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
/** A section of one page is just its link; a section of several (Workflows with sdv-js) is a category of them. */
const items = (pages: readonly NotebookPage[]): Item[] =>
  pages.flatMap((p): Item[] => {
    const own = p.path ? [link(p.name, p.path)] : [];
    const sub = items(p.pages ?? []);
    return sub.length > 1
      ? [...own, { type: "category", label: p.name, collapsed: false, items: sub }]
      : [...own, ...sub];
  });

/** The Observable Framework notebooks; docusaurus.config.ts places this category after the generated Gallery. */
export const notebooks = {
  type: "category" as const,
  label: "Notebooks",
  collapsed: false,
  items: [link("All notebooks", "/"), ...items(notebooksConfig.pages as readonly NotebookPage[])],
};
