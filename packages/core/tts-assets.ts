// Build-time (Node) helper for the apps' Vite configs, never shipped to the browser.
// Serves/emits the wasm files the TTS worker loads, from our own origin:
// remote code is blocked by the extension CSP and we want no CDN anyway.
import { createReadStream, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";

const require = createRequire(import.meta.url);

// single-threaded SIMD only: threads are pinned to 1, and every browser
// that runs this has wasm-SIMD, so the other ort builds are dead weight
const FILES: Record<string, string> = {
  // ort's `exports` hides dist/*.wasm; its main entry sits next to them
  "ort-wasm-simd.wasm": join(
    dirname(require.resolve("onnxruntime-web")),
    "ort-wasm-simd.wasm",
  ),
  "piper_phonemize.wasm":
    require.resolve("@diffusionstudio/piper-wasm/build/piper_phonemize.wasm"),
  "piper_phonemize.data":
    require.resolve("@diffusionstudio/piper-wasm/build/piper_phonemize.data"),
};

/** Serves the TTS files at /<dir>/ in dev and emits them there in client builds. */
export function ttsAssets(dir = "tts"): Plugin {
  return {
    name: "sr-tts-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split("?")[0]?.slice(dir.length + 2);
        const file = req.url?.startsWith(`/${dir}/`) && name && FILES[name];
        if (!file) return next();
        res.setHeader(
          "content-type",
          name.endsWith(".wasm")
            ? "application/wasm"
            : "application/octet-stream",
        );
        createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      if (this.environment.config.consumer !== "client") return;
      for (const [name, file] of Object.entries(FILES)) {
        this.emitFile({
          type: "asset",
          fileName: `${dir}/${name}`,
          source: readFileSync(file),
        });
      }
    },
  };
}
