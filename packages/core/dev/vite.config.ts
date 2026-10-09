// Dev playground only: `pnpm --filter @sr/core dev`
import { defineConfig } from "vite";
import { ttsAssets } from "../tts-assets";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [ttsAssets()],
  worker: { format: "es" },
});
