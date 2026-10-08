// A pre-loader for docs pages (registered by docs/plugins/sdv-examples.ts). remark-live inlines
// examples/out/<id>.json into each <Live id="…"> while the page compiles, but a remark plugin cannot declare a
// loader dependency, so a warm persistent build cache kept a page whose source text had not changed even after
// its example's output had. Each page now depends on the outputs it names. The source passes through unchanged.
const { join } = require("node:path");

/** The ids of an MDX source's `<Live id="…">` tags (remark-live accepts only a literal id). */
const liveIds = (source) => [...source.matchAll(/<Live\b[^>]*?\bid=(["'])(.+?)\1/g)].map((m) => m[2]);

module.exports = function liveDeps(source) {
  const { outDir } = this.getOptions();
  for (const id of liveIds(source)) this.addDependency(join(outDir, `${id}.json`));
  return source;
};
module.exports.liveIds = liveIds;
