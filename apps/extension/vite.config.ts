import path from "node:path";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import manifest from "./manifest.config.ts";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  plugins: [tailwindcss(), crx({ manifest })],
  worker: { format: "es" },
  build: {
    rollupOptions: {
      // CRXJS can't see the offscreen page from the manifest.
      input: { offscreen: "src/offscreen/index.html" },
    },
  },
  server: {
    cors: { origin: [/chrome-extension:\/\//] },
  },
});
