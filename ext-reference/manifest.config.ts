import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: "Simple Reader",
  description:
    "Read any webpage aloud with a fully local TTS voice and in-place sentence highlighting.",
  version: pkg.version,
  icons: {
    48: "public/logo.png",
  },
  action: {
    default_icon: {
      48: "public/logo.png",
    },
    default_popup: "src/popup/index.html",
    default_title: "Simple Reader",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      js: ["src/content/main.ts"],
      matches: ["https://*/*", "http://*/*"],
    },
  ],
  permissions: ["offscreen", "storage"],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
});
