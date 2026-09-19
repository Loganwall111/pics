import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { IcosahedronGeometry, MeshStandardMaterial } from "three";
import { ITEMS, scatterPickups, type PickupSpot } from "@/lib/simulation/items";
import { useInventoryStore } from "@/state/stores/inventoryStore";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { frameState } from "@/state/transient/frameState";
import { npcShared } from "./NPCManager";
import { audio } from "@/engine/audio/AudioSystem";

/**
 * World pickups (v1.1 — §items).
 *
 * Seeded item orbs (plaza ring + villages + house interiors): bob and spin,
 * collect with E within 2.2 m (when no dialogue NPC is engaging), respawn
 * after 20 s. Inventory logic is pure (items.ts) — this component only
 * renders and triggers.
 */

const PICKUP_RANGE = 2.2;
const RESPAWN_SECONDS = 20;

export function Pickups(): React.JSX.Element {
  const citySeed = useSettingsStore((s) => s.citySeed);
  const spots = useMemo<PickupSpot[]>(() => scatterPickups(citySeed), [citySeed]);

  const geo = useMemo(() => new IcosahedronGeometry(0.3, 0), []);
  const mats = useMemo(() => {
    const map = new Map<string, MeshStandardMaterial>();
    for (const def of Object.values(ITEMS)) {
      map.set(
        def.color,
        new MeshStandardMaterial({
          color: def.color,
          emissive: def.color,
          emissiveIntensity: 1.4,
          roughness: 0.3,
        })
      );
    }
    return map;
  }, []);

  useEffect(() => {
    return () => {
      geo.dispose();
      for (const m of mats.values()) m.dispose();
    };
  }, [geo, mats]);

  const meshRefs = useRef<(import("three").Mesh | null)[]>([]);
  const hiddenUntil = useRef<number[]>(spots.map(() => -1));
  const interactAccum = useRef(0);

  useFrame((_, delta) => {
    const now = frameState.clock.shaderTimeSeconds;
    const pp = npcShared.playerPosition;
    const store = useSimulationStore.getState();
    const input = frameState.input;

    for (let i = 0; i < spots.length; i++) {
      const spot = spots[i];
      const mesh = meshRefs.current[i];
      if (!spot || !mesh) continue;

      if (now < (hiddenUntil.current[i] ?? -1)) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.rotation.y = now * 1.3 + i;
      mesh.position.y = spot.y + Math.sin(now * 2 + i * 1.7) * 0.12;

      // 10 Hz pickup check (never per-orb input queries).
      interactAccum.current += delta;
      if (interactAccum.current < 0.1) continue;
      interactAccum.current = 0;
      if (
        input?.wasPressed(8 /* SimAction.Interact */) &&
        store.playerState === "on-foot" &&
        !store.dialogue.active &&
        store.nearbyNpcId === null
      ) {
        const d2 = (spot.x - pp.x) * (spot.x - pp.x) + (spot.z - pp.z) * (spot.z - pp.z);
        if (d2 <= PICKUP_RANGE * PICKUP_RANGE) {
          const ok = useInventoryStore.getState().pickup(spot.item);
          if (ok) {
            hiddenUntil.current[i] = now + RESPAWN_SECONDS;
            audio.blip();
          }
        }
      }
    }
  });

  return (
    <group>
      {spots.map((spot, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          geometry={geo}
          material={mats.get(ITEMS[spot.item]?.color ?? "#ffffff") ?? undefined}
          position={[spot.x, spot.y, spot.z]}
        />
      ))}
    </group>
  );
}
