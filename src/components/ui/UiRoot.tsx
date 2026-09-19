import { HUD } from "./hud/HUD";
import { DialogueOverlay } from "./dialogue/DialogueOverlay";
import { LoadingScreen } from "./hud/LoadingScreen";
import { ErrorOverlay } from "./diagnostics/ErrorOverlay";

/**
 * HTML UI layer (§2 UI Layer). Sits above the fixed canvas; its own pointer
 * events never reach the canvas drag handler except on the game surface
 * itself (camera drag binds to the canvas element, not the window).
 */
export function UiRoot(): React.JSX.Element {
  return (
    <>
      <LoadingScreen />
      <HUD />
      <DialogueOverlay />
      <ErrorOverlay />
    </>
  );
}
