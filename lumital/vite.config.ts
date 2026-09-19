import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * LUMITAL dev/build config — a second app living beside Aether City in this
 * repo. Dependencies resolve from the workspace root node_modules (walk-up),
 * so one `npm ci` serves both games.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    // Sandbox preview proxies request the app under its own host name.
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
  },
});
