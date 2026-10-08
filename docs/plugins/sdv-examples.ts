import { cpSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { LoadContext, Plugin } from "@docusaurus/types";
import { DEFINES, SOURCES, abs } from "../../examples/sources";

const require = createRequire(import.meta.url);
const dir = (pkg: string): string => dirname(require.resolve(`${pkg}/package.json`));

/**
 * Bundles the examples (and the package SOURCE they import, exactly as the gate runs them) into the client build;
 * the server build gets no example code at all (its loaders are an empty stub; <Live> only loads in an effect).
 * Makes each docs page depend on the example outputs its <Live> tags inline (examples/scripts/live-deps.cjs).
 * After the build, copies the Observable Framework notebooks into /notebooks.
 */
export default function sdvExamples(_context: LoadContext): Plugin {
  return {
    name: "sdv-examples",
    configureWebpack(_config, isServer, utils) {
      return {
        resolve: {
          alias: {
            ...Object.fromEntries(Object.entries(SOURCES).map(([spec, file]) => [`${spec}$`, abs(file)])),
            "@sportsdataverse/examples/loaders$": isServer
              ? abs("docs/plugins/no-loaders.ts")
              : abs("examples/src/loaders.gen.ts"),
            react: dir("react"), // one React: the docs' own
            "react-dom": dir("react-dom"),
          },
          // Package and example sources import "./x.js" for "./x.ts" (NodeNext); webpack needs telling.
          extensionAlias: { ".js": [".ts", ".tsx", ".js"] },
        },
        module: {
          rules: [
            // A page holding <Live id> is compiled from examples/out/<id>.json too: a warm cache must see it change.
            {
              test: /\.mdx?$/,
              // An MDX rule without include breaks Docusaurus' fallback MDX rule (it excludes every MDX rule's include).
              include: abs("docs/docs/"),
              enforce: "pre",
              use: [
                { loader: abs("examples/scripts/live-deps.cjs"), options: { outDir: abs("examples/out") } },
              ],
            },
          ],
        },
        plugins: [new utils.currentBundler.instance.DefinePlugin(DEFINES)],
      };
    },
    async postBuild({ outDir }) {
      const notebooks = abs("notebooks/dist");
      if (existsSync(notebooks)) cpSync(notebooks, join(outDir, "notebooks"), { recursive: true });
    },
  };
}
