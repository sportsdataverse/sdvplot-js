// A loader for the Perspective 5.5 viewer and charts builds: each `import(<expression>)` of a URL made at run time (a
// blob URL of the WebAssembly glue) gets `/* webpackIgnore: true */`, so the bundler leaves it to the browser instead
// of turning it into a lookup among its own modules ("Cannot find module 'blob:…'"). An import of a string literal,
// `import.meta` and a method named `import` (`o.import(x)`) are left as they are. Rspack, which this site builds with,
// has no parser switch for it; the magic comment works in Rspack and webpack 5 alike.
//
// A file this loader is pointed at with no such import fails the build: a Perspective that loads its glue another way
// must be looked at, not bundled into pages that break only in the browser.
const IMPORT = /(?<![\w$.])import\((?=[A-Za-z_$])/g;

module.exports = function importUrlLoader(source) {
  let n = 0;
  const out = source.replace(IMPORT, () => {
    n++;
    return "import(/* webpackIgnore: true */ ";
  });
  if (n === 0)
    throw new Error(
      `import-url-loader: ${this.resourcePath} has no import() of an expression to leave to the browser; Perspective may load its WebAssembly glue another way now (see docs/plugins/sdv-examples.ts)`,
    );
  return out;
};
