import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { createLogger } from "@/lib/utilities/logger";

const log = createLogger("resize-guard");

/**
 * Canvas dimension guard (§4).
 *
 * R3F handles resize internally (ResizeObserver); this guard additionally
 * validates that a zero-sized canvas never propagates silently: collapsed
 * dimensions (display:none tabs, detached hosts) are reported once to the
 * diagnostics pipeline until the canvas becomes valid again.
 */
export function ResizeGuard(): null {
  const size = useThree((s) => s.size);
  const invalid = size.width === 0 || size.height === 0;
  const wasInvalid = useRef(false);

  useEffect(() => {
    if (invalid && !wasInvalid.current) {
      wasInvalid.current = true;
      log.error("canvas collapsed to zero size — suspending diagnostics until restored");
    } else if (!invalid && wasInvalid.current) {
      wasInvalid.current = false;
      log.info(`canvas restored to ${size.width}×${size.height}`);
    }
  }, [invalid, size.width, size.height]);

  return null;
}
