import { cp } from "node:fs/promises";
import path from "node:path";
import { crx } from "@crxjs/vite-plugin";
import { defineConfig, type Plugin } from "vite";
import zip from "vite-plugin-zip-pack";
import manifest from "./manifest.config.js";
import { name, version } from "./package.json";

// Runtime wasm assets, bundled locally so nothing loads from a CDN
// (remote scripts are blocked by the extension CSP):
// onnxruntime wasm + the piper phonemizer (espeak-ng) wasm/data.
const WASM_ASSETS: [src: string, dest: string][] = [
  // single-threaded SIMD only: threads are pinned to 1 (CSP), and every
  // Chrome that can run MV3 has wasm-SIMD, so the plain fallback is dead weight
  ["node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm", "ort/ort-wasm-simd.wasm"],
  ["node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.data", "piper/piper_phonemize.data"],
  ["node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.wasm", "piper/piper_phonemize.wasm"],
];

function copyWasmAssets(): Plugin {
  return {
    name: "copy-wasm-assets",
    apply: "build",
    // enforce ordering: run before zip-pack reads the dist folder
    enforce: "pre",
    async closeBundle() {
      for (const [src, dest] of WASM_ASSETS) {
        await cp(
          path.resolve(import.meta.dirname, src),
          path.resolve(import.meta.dirname, "dist", dest),
        );
      }
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  plugins: [
    crx({ manifest }),
    copyWasmAssets(),
    zip({ outDir: "release", outFileName: `crx-${name}-${version}.zip` }),
  ],
  worker: {
    format: "es",
  },
  build: {
    rollupOptions: {
      input: {
        offscreen: "src/offscreen/index.html",
      },
    },
  },
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
});
