import * as esbuild from "esbuild";
import { cp, mkdir, readdir } from "fs/promises";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const watch = process.argv.includes("--watch");

await mkdir(join(dist, "ort"), { recursive: true });

// Static assets
for (const file of ["manifest.json"]) {
  await cp(join(root, file), join(dist, file));
}
for (const file of ["popup.html", "popup.css", "offscreen.html", "content.css"]) {
  await cp(join(root, "src", file), join(dist, file));
}

// onnxruntime wasm runtime shipped inside transformers.js dist — copy the
// exact files the bundled runtime expects so nothing is fetched from a CDN.
const require = createRequire(import.meta.url);
const transformersDist = dirname(require.resolve("@huggingface/transformers"));
for (const file of await readdir(transformersDist)) {
  if (/^ort-.*\.(wasm|mjs)$/.test(file)) {
    await cp(join(transformersDist, file), join(dist, "ort", file));
  }
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
