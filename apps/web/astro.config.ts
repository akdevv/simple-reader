import { defineConfig, envField } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import { ttsAssets } from "@sr/core/tts-assets";
import { readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * onnxruntime-node (semantic search) ships native binaries for every OS
 * (~150MB extra); a Vercel function only runs linux x64. The adapter's
 * excludeFiles takes exact paths, not globs, so list the rest here.
 */
function foreignOnnxBinaries(): string[] {
  const require = createRequire(import.meta.url);
  // .../node_modules/@huggingface/transformers/dist/x.js → .../node_modules/onnxruntime-node
  const transformers = realpathSync(
    require.resolve("@huggingface/transformers"),
  );
  const bin = join(dirname(transformers), "../../../onnxruntime-node/bin");
  try {
    return readdirSync(realpathSync(bin), {
      recursive: true,
      withFileTypes: true,
    })
      .filter((f) => f.isFile())
      .map((f) => join(f.parentPath, f.name))
      .filter((f) => !/[/\\]linux[/\\]x64[/\\]/.test(f));
  } catch {
    return [];
  }
}

const secret = (optional = false) =>
  envField.string({ context: "server", access: "secret", optional });

export default defineConfig({
  // Pages render on request (auth, per-user data); static ones opt in with `prerender = true`.
  output: "server",
  adapter: vercel({ excludeFiles: foreignOnnxBinaries() }),
  integrations: [icon()],
  env: {
    schema: {
      DATABASE_URL: secret(),
      BETTER_AUTH_SECRET: secret(),
      // unset = inferred from the request (Vercel preview URLs vary)
      BETTER_AUTH_URL: secret(true),
      // social sign-in is off until these are set
      GOOGLE_CLIENT_ID: secret(true),
      GOOGLE_CLIENT_SECRET: secret(true),
      GITHUB_CLIENT_ID: secret(true),
      GITHUB_CLIENT_SECRET: secret(true),
      GEMINI_API_KEY: secret(true),
      GEMINI_MODEL: secret(true),
    },
  },
  vite: {
    // ttsAssets: the Piper/onnx wasm files the reader's TTS worker loads from /tts/
    plugins: [tailwindcss(), ttsAssets()],
    worker: { format: "es" },
  },
});
