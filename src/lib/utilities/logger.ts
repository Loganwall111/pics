import { useSimulationStore } from "@/state/stores/simulationStore";

/**
 * Structured subsystem logger (specification §24, §34).
 * - info/warn go to the console with a subsystem tag.
 * - error additionally enters the diagnostics store, which the error overlay
 *   renders, so runtime failures are visible in the shipped product.
 * Empty catch blocks are forbidden by contract; every catch must log through
 * this module or rethrow.
 */

export interface Logger {
  info: (message: string, extra?: unknown) => void;
  warn: (message: string, extra?: unknown) => void;
  error: (message: string, extra?: unknown, fatal?: boolean) => void;
}

export function createLogger(subsystem: string): Logger {
  const tag = `[${subsystem}]`;
  return {
    info: (message, extra) => {
      if (extra !== undefined) console.info(tag, message, extra);
      else console.info(tag, message);
    },
    warn: (message, extra) => {
      if (extra !== undefined) console.warn(tag, message, extra);
      else console.warn(tag, message);
    },
    error: (message, extra, fatal = false) => {
      if (extra !== undefined) console.error(tag, message, extra);
      else console.error(tag, message);
      const detail = extra instanceof Error ? `: ${extra.message}` : extra !== undefined ? `: ${String(extra)}` : "";
      useSimulationStore.getState().pushError(subsystem, `${message}${detail}`, fatal);
    },
  };
}
