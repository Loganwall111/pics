import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { getHeroVehicleBody, exitVehiclePlacement, HERO_VEHICLE_ID } from "@/components/world/vehicles/Vehicle";
import { getNpcDefinition, getScript } from "./npcDefinitions";
import { getPlayerBody } from "./Player";
import { npcShared } from "./NPCManager";
import { resolveInteraction, VEHICLE_EXIT_SPEED_LIMIT_MS } from "@/lib/simulation/interaction";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { audio } from "@/engine/audio/AudioSystem";
import { frameState } from "@/state/transient/frameState";
import { SimAction } from "@/engine/input/actions";

/**
 * Interaction orchestrator (§17, §18).
 *
 * Runs the pure `resolveInteraction` decision function once per frame against
 * the current context (player state, nearest NPC from the spatial hash,
 * vehicle proximity, input edges) and applies the decision to the simulation
 * store. Also publishes the player's physics position into `npcShared` for
 * the NPC visuals and dialogue positioning.
 *
 * Freeze policy: only player/vehicle *control* is locked (the controllers
 * read `dialogue.active`); the physics world, sky, particles and NPCs keep
 * simulating throughout a conversation.
 */
export function InteractionSystem(): null {
  const tmpPos = useRef(new Vector3());
  const thunderArmed = useRef(true);

  useEffect(() => {
    // No listeners of its own: input edges come from the central InputManager.
    return () => {
      const store = useSimulationStore.getState();
      if (store.dialogue.active) store.closeDialogue();
    };
  }, []);

  useFrame(() => {
    const store = useSimulationStore.getState();
    const input = frameState.input;
    if (!input) return;

    // Publish player position (on foot) for NPC facing / dialogue.
    const heroBody = getHeroVehicleBody();
    if (store.playerState === "on-foot") {
      // Player body position is mirrored by PlayerController into npcShared.
    } else if (store.playerState === "driving" && heroBody) {
      const t = heroBody.translation();
      npcShared.playerPosition.x = t.x;
      npcShared.playerPosition.y = t.y;
      npcShared.playerPosition.z = t.z;
    }

    // Mode hotkeys (1..5) — handled here so mode logic lives in one place.
    const settings = useSettingsStore.getState();
    if (input.wasPressed(SimAction.SelectMetropolis)) settings.setMode("METROPOLIS");
    else if (input.wasPressed(SimAction.SelectLowGravity)) settings.setMode("LOW_GRAVITY");
    else if (input.wasPressed(SimAction.SelectOrbital)) settings.setMode("ORBITAL");
    else if (input.wasPressed(SimAction.SelectDeepSpace)) settings.setMode("DEEP_SPACE");
    else if (input.wasPressed(SimAction.SelectLab)) settings.setMode("LAB");
    if (input.wasPressed(SimAction.ToggleDiagnostics)) settings.toggleStatsPanel();
    if (input.wasPressed(SimAction.ToggleSettings)) settings.toggleConfigPanel();
    if (input.wasPressed(SimAction.FirstPerson)) frameState.firstPerson = !frameState.firstPerson;
    if (input.wasPressed(SimAction.ToggleAudio)) {
      settings.setMuted();
      audio.setMuted(settings.muted);
    }
    if (input.wasPressed(SimAction.Cancel)) {
      if (store.dialogue.active) store.closeDialogue();
      else if (settings.arPanel !== "none") settings.setArPanel("none");
    }

    // Interaction decisions (§17 pipeline).
    const nearNpcId = store.nearbyNpcId;
    const npc = nearNpcId ? getNpcDefinition(nearNpcId) : null;
    const decision = resolveInteraction({
      playerPosition: npcShared.playerPosition,
      onFoot: store.playerState === "on-foot",
      nearestNpc:
        npc && nearNpcId
          ? {
              id: npc.id,
              // Live wandered position (falls back to the anchor).
              position: {
                x: npcShared.livePositions[npc.index ?? -1]?.x ?? npc.x,
                y: 0,
                z: npcShared.livePositions[npc.index ?? -1]?.z ?? npc.z,
              },
              interactRadius: npc.interactRadius,
            }
          : null,
      nearestVehicle:
        store.playerState === "on-foot" && heroBody && vehicleNear()
          ? { id: HERO_VEHICLE_ID }
          : null,
      playerState: store.playerState,
      dialogueActive: store.dialogue.active,
      interactPressed: input.wasPressed(SimAction.Interact),
      cancelPressed: input.wasPressed(SimAction.Cancel),
    });

    switch (decision.kind) {
      case "open-dialogue": {
        store.openDialogue(decision.npcId);
        audio.blip();
        frameState.dialogueCommand = 0;
        break;
      }
      case "advance-dialogue": {
        if (frameState.dialogueTyping) {
          frameState.dialogueCommand = 1; // reveal instantly
        } else {
          frameState.dialogueCommand = 2; // next entry / close
        }
        break;
      }
      case "close-dialogue":
        store.closeDialogue();
        frameState.dialogueCommand = 0;
        break;
      case "enter-vehicle": {
        store.setPlayerState("driving");
        audio.blip();
        break;
      }
      case "exit-vehicle": {
        const body = getHeroVehicleBody();
        const player = getPlayerBody();
        if (body && player) {
          const v = body.linvel();
          const speed = Math.hypot(v.x, v.y, v.z);
          if (speed < VEHICLE_EXIT_SPEED_LIMIT_MS) {
            exitVehiclePlacement(body, tmpPos.current);
            // Place + re-enable the player body at the driver door.
            player.setEnabled(true);
            player.setTranslation(
              { x: tmpPos.current.x, y: tmpPos.current.y, z: tmpPos.current.z },
              true
            );
            player.setLinvel({ x: 0, y: 0, z: 0 }, true);
            store.setPlayerState("on-foot");
            npcShared.playerPosition.x = tmpPos.current.x;
            npcShared.playerPosition.y = tmpPos.current.y;
            npcShared.playerPosition.z = tmpPos.current.z;
          }
        }
        break;
      }
      case "none":
        break;
    }

    // Thunder on lightning rising edge (weather → audio coupling, §33).
    const lightning = frameState.weather.lightning;
    if (lightning > 0.35 && thunderArmed.current) {
      audio.thunder();
      thunderArmed.current = false;
    } else if (lightning < 0.05) {
      thunderArmed.current = true;
    }

    // Dialogue progression consumed by DialogueOverlay via the store.
    if (frameState.dialogueCommand === 2) {
      const npcId = store.dialogue.npcId;
      const script = npcId ? getScript(npcId) : [];
      store.advanceDialogue(script);
      frameState.dialogueCommand = 0;
    }
  });

  return null;
}

/** Vehicle within 4 m of the player? (uses shared position holder) */
function vehicleNear(): boolean {
  const body = getHeroVehicleBody();
  if (!body) return false;
  const t = body.translation();
  const dx = t.x - npcShared.playerPosition.x;
  const dz = t.z - npcShared.playerPosition.z;
  return dx * dx + dz * dz < 16;
}
