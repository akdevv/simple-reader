import { defineConfig } from "vitest/config";

// Plain Vite config for unit tests of framework-free modules (no Astro plugins).
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
