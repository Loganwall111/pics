import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { applyRendererConfig, attachContextLossHandlers } from "@/engine/rendering/rendererConfig";
import { RenderQualityManager } from "@/engine/rendering/RenderQualityManager";
import { ResizeGuard } from "@/engine/rendering/ResizeGuard";
import { SimulationLoop } from "@/engine/simulation/SimulationLoop";
import { InputSystem, InputFinalizer } from "@/engine/input/InputSystem";
import { AppRoutes } from "./routes/AppRoutes";
import { ErrorBoundary } from "./providers/ErrorBoundary";
import { GlobalErrorListeners } from "./providers/GlobalErrorListeners";
import { UiRoot } from "@/components/ui/UiRoot";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { audio } from "@/engine/audio/AudioSystem";
import { AudioLink } from "@/engine/audio/AudioLink";
import { useSettingsStore } from "@/state/stores/settingsStore";

/**
 * Application shell (§2, §4).
 *
 * The <Canvas> host is a fixed full-viewport surface (see index.html +
 * styles.css). Renderer configuration is centralized and applied exactly
 * once in onCreated — never from a React render path (§4).
 */
export function App(): React.JSX.Element {
  const cleanupRef = useRef<(() => void) | null>(null);

  // Autoplay policy: audio wakes on the first user gesture anywhere.
  const handleGesture = (): void => {
    audio.resume();
    audio.setMuted(useSettingsStore.getState().muted);
  };

  const handleCreated = ({ gl }: { gl: import("three").WebGLRenderer }): void => {
    applyRendererConfig(gl, useSettingsStore.getState().quality);
    cleanupRef.current?.();
    cleanupRef.current = attachContextLossHandlers(gl.domElement);
    useSimulationStore.getState().setCanvasReady(true);
  };

  return (
    <ErrorBoundary>
      <GlobalErrorListeners />
      <div className="canvas-host" onPointerDown={handleGesture} onKeyDown={handleGesture}>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ fov: 62, near: 0.12, far: 7000, position: [10, 6, 18] }}
          gl={{
            antialias: true,
            alpha: false,
            stencil: false,
            depth: true,
            powerPreference: "high-performance",
            preserveDrawingBuffer: false,
          }}
          frameloop="always"
          onCreated={handleCreated}
        >
          {/* Order matters: clock/input first, finalize last (§5). */}
          <SimulationLoop />
          <InputSystem />
          <AudioLink />
          <RenderQualityManager />
          <ResizeGuard />
          <AppRoutes />
          <InputFinalizer />
        </Canvas>
      </div>
      <UiRoot />
    </ErrorBoundary>
  );
}
