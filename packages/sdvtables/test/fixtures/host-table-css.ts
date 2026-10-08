// Real host-page table CSS, copied verbatim (values of the theme variables resolved per mode), for the
// "host table CSS" render test. A host's global table rules must not change an sdvtables cell's ink or ground.

/**
 * Observable Framework 1.13.4, the notebooks' pinned version (notebooks/package-lock.json):
 * dist/style/global.css:1-35 (fonts), :37-47 (html, body) and :172-210 (the table rules), installed under notebooks/node_modules.
 * The variables are the default theme pair, theme-air.css (light) and theme-near-midnight.css (dark), through
 * abstract-light.css / abstract-dark.css.
 */
const FRAMEWORK_RULES = `
html{background:var(--theme-background);color:var(--theme-foreground)}
body{font:17px/1.5 var(--serif);margin:0}
table{width:100%;border-collapse:collapse;font:13px/1.2 var(--sans-serif)}
th{color:var(--theme-foreground);text-align:left;vertical-align:bottom}
td{color:var(--theme-foreground-alt);vertical-align:top}
th,td{padding:3px 6.5px 3px 0}
th:last-child,td:last-child{padding-right:0}
tr:not(:last-child){border-bottom:solid 1px var(--theme-foreground-faintest)}
thead tr{border-bottom:solid 1px var(--theme-foreground-fainter)}
table{margin:1rem 0}`;
const FRAMEWORK_FONTS = `--serif:"Source Serif 4","Iowan Old Style","Apple Garamond","Palatino Linotype","Times New Roman","Droid Serif",Times,serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol";--sans-serif:-apple-system,BlinkMacSystemFont,"avenir next",avenir,helvetica,"helvetica neue",ubuntu,roboto,noto,"segoe ui",arial,sans-serif;`;
/** abstract-light.css mixes toward --theme-background-a, abstract-dark.css toward --theme-background-b (`base`). */
const frameworkVars = (fg: string, background: string, base: string): string =>
  `:root{${FRAMEWORK_FONTS}--theme-foreground:${fg};--theme-background:${background};` +
  `--theme-foreground-alt:color-mix(in srgb,${fg} 90%,${base});--theme-foreground-fainter:color-mix(in srgb,${fg} 30%,${base});` +
  `--theme-foreground-faintest:color-mix(in srgb,${fg} 14%,${base})}`;

/**
 * Docusaurus 3 (Infima 0.2.0-alpha.45, the docs site's lockfile version):
 * node_modules/infima/dist/css/default/default.css:1175-1214 (the table rules) with its defaults at :215-227,
 * and this repo's own overrides, docs/src/css/sdv-theme.css:75-78 (light) and :99-102 (dark).
 */
const INFIMA_RULES = `
table{border-collapse:collapse;display:block;margin-bottom:var(--ifm-spacing-vertical);overflow:auto}
table thead tr{border-bottom:2px solid var(--ifm-table-border-color)}
table thead{background-color:var(--ifm-table-stripe-background)}
table tr{background-color:var(--ifm-table-background);border-top:var(--ifm-table-border-width) solid var(--ifm-table-border-color)}
table tr:nth-child(2n){background-color:var(--ifm-table-stripe-background)}
table th,table td{border:var(--ifm-table-border-width) solid var(--ifm-table-border-color);padding:var(--ifm-table-cell-padding)}
table th{background-color:var(--ifm-table-head-background);color:var(--ifm-table-head-color);font-weight:var(--ifm-table-head-font-weight)}
table td{color:var(--ifm-table-cell-color)}`;
const infimaVars = (bg: string, fg: string, border: string, stripe: string): string =>
  `:root{--ifm-spacing-vertical:1rem;--ifm-table-cell-padding:0.75rem;--ifm-table-background:transparent;--ifm-table-border-width:1px;` +
  `--ifm-table-head-background:inherit;--ifm-table-head-color:inherit;--ifm-table-head-font-weight:700;--ifm-table-cell-color:inherit;` +
  `--ifm-table-border-color:${border};--ifm-table-stripe-background:${stripe}}html{background:${bg};color:${fg}}`;

/** host name -> the `<style>` body a page carries before the table */
export const HOST_TABLE_CSS: Readonly<Record<string, string>> = {
  "framework-light": frameworkVars("#1b1e23", "#ffffff", "#ffffff") + FRAMEWORK_RULES,
  "framework-dark": frameworkVars("#dfdfd6", "color-mix(in srgb,#dfdfd6 4%,#161616)", "#161616") + FRAMEWORK_RULES,
  "docusaurus-light": infimaVars("#ffffff", "#1c1e21", "#d8e0eb", "#e7edf5") + INFIMA_RULES,
  "docusaurus-dark": infimaVars("#0b1220", "#e9eef6", "#223350", "#1a2740") + INFIMA_RULES,
};
