import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest runs the mathematical / deterministic test suites in plain Node.
 * No DOM environment is required: every unit under test is intentionally
 * free of WebGL / DOM dependencies so the physics-accurate math can be
 * validated headlessly.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
  },
});
