import { defineConfig } from "tsup"

export default defineConfig([
  // npm: ES module + CommonJS with types; phoenix and the QR library stay dependencies.
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2020",
  },
  // <script src="pairmesh.global.js">: everything bundled, exposed as window.PairMesh.
  {
    entry: { pairmesh: "src/global.ts" },
    format: ["iife"],
    globalName: "PairMesh",
    footer: { js: "PairMesh = PairMesh.default;" },
    noExternal: [/.*/],
    minify: true,
    sourcemap: true,
    target: "es2020",
  },
])
