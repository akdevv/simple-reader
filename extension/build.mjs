import * as esbuild from "esbuild";
import { cp, mkdir, readdir } from "fs/promises";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const watch = process.argv.includes("--watch");

await mkdir(join(dist, "ort"), { recursive: true });
await mkdir(join(dist, "piper"), { recursive: true });

// Static assets
for (const file of ["manifest.json"]) {
  await cp(join(root, file), join(dist, file));
}
for (const file of ["popup.html", "popup.css", "offscreen.html", "content.css"]) {
  await cp(join(root, "src", file), join(dist, file));
}

// Runtime wasm assets, copied locally so nothing loads from a CDN:
// onnxruntime wasm + the piper phonemizer (espeak-ng) wasm/data.
const require = createRequire(import.meta.url);
const ortDist = dirname(require.resolve("onnxruntime-web")); // entry lives in dist/
for (const file of await readdir(ortDist)) {
  // single-threaded only (threads are pinned to 1; jsep/webgpu unused)
  if (/^ort-wasm(-simd)?\.wasm$/.test(file)) {
    await cp(join(ortDist, file), join(dist, "ort", file));
  }
}
// no package entry point — reach into the symlinked package directly
const piperBuild = join(root, "node_modules/@diffusionstudio/piper-wasm/build");
for (const file of ["piper_phonemize.data", "piper_phonemize.wasm"]) {
  await cp(join(piperBuild, file), join(dist, "piper", file));
}

const ctx = await esbuild.context({
  entryPoints: [
    "src/background.ts",
    "src/content.ts",
    "src/offscreen.ts",
    "src/popup.ts",
  ],
  bundle: true,
  format: "iife",
  // dead Node-only branches in emscripten glue (guarded by ENVIRONMENT_IS_NODE)
  external: ["fs", "path"],
  outdir: "dist",
  absWorkingDir: root,
  alias: { "@": join(root, "..") }, // reuse the app's lib/ (e.g. sentence splitter)
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
