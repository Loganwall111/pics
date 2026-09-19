import { useEffect } from "react";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { createLogger } from "@/lib/utilities/logger";

const log = createLogger("global-errors");

/**
 * Window-level failure capture (§24): uncaught exceptions and unhandled
 * promise rejections enter the diagnostics store — no silent failures, no
 * unhandled promises anywhere in the async subsystems.
 */
export function GlobalErrorListeners(): null {
  useEffect(() => {
    const onError = (e: ErrorEvent): void => {
      log.error(`uncaught: ${e.message}`, e.filename ? `${e.filename}:${e.lineno}` : undefined);
      useSimulationStore.getState().pushError("window", `Uncaught: ${e.message}`);
    };
    const onRejection = (e: PromiseRejectionEvent): void => {
      const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
      log.error(`unhandled rejection: ${reason}`);
      useSimulationStore.getState().pushError("async", `Unhandled rejection: ${reason}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
