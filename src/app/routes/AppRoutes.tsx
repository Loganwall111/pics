import { WorldScene } from "@/components/world/WorldScene";
import { SpaceScene } from "@/components/world/space/SpaceScene";
import { LabScene } from "@/components/world/lab/LabScene";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { selectMode } from "@/state/selectors";
import { MODE_SCENE } from "@/state/stores/settingsStore";
import type { SceneRoute } from "@/types";

/**
 * Scene router (§3 routes/ contract).
 *
 * A mode change that implies a different scene unmounts the entire previous
 * scene subtree: the Rapier world is torn down, every scene-local effect
 * cleanup runs, and GPU resources created by scene components are disposed
 * (§22). The hash-based route in settingsStore stays in sync with mode.
 */
export function AppRoutes(): React.JSX.Element {
  const mode = useSettingsStore(selectMode);
  const scene: SceneRoute = MODE_SCENE[mode];

  switch (scene) {
    case "city":
      return <WorldScene key="city" />;
    case "space":
      return <SpaceScene key="space" />;
    case "lab":
      return <LabScene key="lab" />;
    default:
      return <WorldScene key="city" />;
  }
}
