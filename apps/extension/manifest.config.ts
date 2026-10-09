import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "Simple Reader",
  description:
    "Read any article in a clean view, with a local voice that highlights along.",
  version: pkg.version,
  icons: { 48: "public/logo.png" },
  action: {
    default_icon: { 48: "public/logo.png" },
    default_popup: "src/popup/index.html",
    default_title: "Simple Reader",
  },
  // Unique basename: CRXJS keys chunks by entry basename, and a collision
  // breaks SW registration ("Status code: 15").
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
