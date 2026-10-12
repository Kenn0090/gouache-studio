RAW photo reader for the Photo tab.
worker.js + libraw.wasm come from the npm package "libraw-wasm" 1.6.0 (ISC licence), which wraps LibRaw (LGPL 2.1 / CDDL 1.0, https://www.libraw.org).
They are used unchanged; the app only patches the place the worker looks for libraw.wasm at run time.
