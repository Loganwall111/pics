import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { frameState } from "@/state/transient/frameState";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { useInventoryStore } from "@/state/stores/inventoryStore";
import { useQuestStore } from "@/state/stores/questStore";
import { getQualityProfile } from "@/engine/rendering/quality";
import { npcShared } from "./NPCManager";

/**
 * Story event wiring (v1.2 — §story).
 *
 * Watches the live world at low frequency and signals the pure quest
 * machine: talk (dialogue opened), collect (item picked), drive (vehicle
 * entered), travel (beyond the city ring), storm (lightning witnessed).
 * No rendering — the HUD pill reads the quest store directly.
 */

const CITY_RING = 300;

export function QuestTracker(): null {
  const talkedRef = useRef(false);
  const collectCount = useRef(0);
  const droveRef = useRef(false);
  const traveledRef = useRef(false);
  const stormedRef = useRef(false);

  // Pickup events arrive via the inventory store (already event-driven).
  useEffect(() => {
    const unsub = useInventoryStore.subscribe((state) => {
      if (state.lastPicked) {
        collectCount.current += 1;
        useQuestStore.getState().signal("collect");
      }
    });
    return unsub;
  }, []);

  useFrame(() => {
    const store = useSimulationStore.getState();
    const quest = useQuestStore.getState();

    if (!talkedRef.current && store.dialogue.active) {
      talkedRef.current = true;
      quest.signal("talk");
    }
    if (!droveRef.current && store.playerState === "driving") {
      droveRef.current = true;
      quest.signal("drive");
    }
    if (!traveledRef.current) {
      const pp = npcShared.playerPosition;
      if (Math.hypot(pp.x, pp.z) > CITY_RING) {
        traveledRef.current = true;
        quest.signal("travel");
      }
    }
    if (!stormedRef.current && frameState.weather.lightning > 0.5) {
      stormedRef.current = true;
      quest.signal("storm");
    }
    void getQualityProfile; // (tier-independent tracker)
  });

  return null;
}
