// A loader for the Perspective 5.5 viewer and charts builds: each `import(<expression>)` of a URL made at run time (a
// blob URL of the WebAssembly glue) gets `/* webpackIgnore: true */`, so the bundler leaves it to the browser instead
// of turning it into a lookup among its own modules ("Cannot find module 'blob:…'"). An import of a string literal is
// left as it is. Rspack, which this site builds with, has no parser switch for it; the magic comment works in Rspack
// and webpack 5 alike.
module.exports = function importUrlLoader(source) {
  return source.replace(/\bimport\((?=[A-Za-z_$])/g, "import(/* webpackIgnore: true */ ");
};
