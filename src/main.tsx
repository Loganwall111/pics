import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./app/styles.css";

/**
 * Entry point (§4).
 *
 * StrictMode is intentionally NOT enabled: its double-invoked effects would
 * attach/detach WebGL contexts, physics worlds and input listeners twice on
 * every mount during development. All effects here are written to be
 * idempotent, but the renderer/physics boot cost is not worth paying twice.
 */
const host = document.getElementById("root");
if (!host) {
  throw new Error("Fatal: #root host element missing from index.html");
}

// The pre-React boot splash lives in index.html; React takes over cleanly.
document.getElementById("boot")?.remove();

// Overlap the Rapier WASM fetch/decode with renderer boot (§21): the chunk is
// dynamically imported by <Physics>; warming it here starts the ~900 kB
// transfer during the splash instead of after canvas mount. The ESM module
// cache makes the later importRapier() resolve instantly. Failure is non-
// fatal here — the authoritative error path is the physics mount itself.
import("@dimforge/rapier3d-compat")
  .then((rapier) => rapier.init())
  .catch((err: unknown) => {
    console.warn("[boot] rapier prefetch failed (will retry on physics mount):", err);
  });

createRoot(host).render(<App />);
