import { cpSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { LoadContext, Plugin } from "@docusaurus/types";
import { DEFINES, SOURCES, abs } from "../../examples/sources";

const require = createRequire(import.meta.url);
const dir = (pkg: string): string => dirname(require.resolve(`${pkg}/package.json`));
/** The chart libraries the browser upgrades draw with: examples/src/draw/<lib>.ts, chunk `draw-<lib>`. */
const CHART_LIBS = ["plotly", "vega", "echarts", "chartjs"] as const;
/**
 * Vega's self-contained build (its d3 inside). The module build imports the d3-* packages Observable Plot imports,
 * and a module imported from two chunks cannot be scope-hoisted into either: every Plot and D3 page grew 4.8 KB
 * (brotli) with it. The file is UMD in a "type": "module" package, so it is parsed as auto, not as ESM.
 */
const VEGA = join(dirname(createRequire(abs("examples/package.json")).resolve("vega")), "vega.min.js");

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
            "@sportsdataverse/examples/browser$": isServer
              ? abs("docs/plugins/no-loaders.ts")
              : abs("examples/src/browser.gen.ts"),
            react: dir("react"), // one React: the docs' own
            "react-dom": dir("react-dom"),
            vega$: VEGA,
          },
          // Package and example sources import "./x.js" for "./x.ts" (NodeNext); webpack needs telling.
          extensionAlias: { ".js": [".ts", ".tsx", ".js"] },
        },
        module: {
          rules: [
            { test: VEGA, type: "javascript/auto" },
            // A page holding <Live id> is compiled from examples/out/<id>.json too: a warm cache must see it change.
            {
              test: /\.mdx?$/,
              // An MDX rule without include breaks Docusaurus' fallback MDX rule (it excludes every MDX rule's include).
              include: abs("docs/docs/"),
              enforce: "pre",
              use: [
                {
                  loader: abs("examples/scripts/live-deps.cjs"),
                  options: { outDir: abs("examples/out"), snippetDir: abs("examples/snippets") },
                },
              ],
            },
          ],
        },
        // Docusaurus turns the default cacheGroups off, so a module two example chunks share is copied into each
        // (the 185 KB of shot JSON went into 118 chunks). The sample data gets one chunk of its own, and package
        // source two example chunks share goes to a shared chunk. [\\/] so the tests match Windows paths too.
        optimization: isServer
          ? {}
          : {
              splitChunks: {
                cacheGroups: {
                  sdvData: {
                    test: /[\\/](examples[\\/]src[\\/]data\.ts|fixtures[\\/]|packages[\\/][^\\/]+[\\/]test[\\/])/,
                    name: "sdv-data",
                    chunks: "async",
                    enforce: true,
                    priority: 30,
                  },
                  sdvSource: {
                    test: /[\\/]packages[\\/][^\\/]+[\\/]src[\\/]/,
                    chunks: "async",
                    minChunks: 2,
                    priority: 20,
                    reuseExistingChunk: true,
                  },
                  // Each chart library, with all it brings from node_modules, is one chunk only its draw module
                  // loads: taken from that chunk alone, never from a chunk a page without the library loads.
                  ...Object.fromEntries(
                    CHART_LIBS.map((lib) => [
                      `lib-${lib}`,
                      {
                        test: /[\\/]node_modules[\\/]/,
                        chunks: (chunk: { name?: string | null }) => chunk.name === `draw-${lib}`,
                        name: `lib-${lib}`,
                        enforce: true,
                        priority: 40,
                      },
                    ]),
                  ),
                },
              },
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
