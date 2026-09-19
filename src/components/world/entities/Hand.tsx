import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  MeshStandardMaterial,
} from "three";
import { ITEMS } from "@/lib/simulation/items";
import { useInventoryStore } from "@/state/stores/inventoryStore";
import { useSimulationStore } from "@/state/stores/simulationStore";
import { frameState } from "@/state/transient/frameState";
import { SimAction } from "@/engine/input/actions";

/**
 * First-person viewmodel (v1.2 — §hand).
 *
 * A right arm + the equipped item riding the camera in first person: idle
 * sway, punch swing on Q, throw flick on T, item color from the equipped
 * hotbar slot. The group is parented to the live camera object (added to
 * the scene once); the whole rig is created once and never reallocates.
 */

const REST_X = 0.34;
const REST_Y = -0.32;
const REST_Z = -0.62;

export function Hand(): React.JSX.Element {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);

  const root = useMemo(() => new Group(), []);
  const swing = useRef(0); // 0 rest → 1 full punch, eases back down

  const geo = useMemo(
    () => ({
      arm: new CapsuleGeometry(0.055, 0.34, 4, 8),
      fist: new CapsuleGeometry(0.075, 0.06, 4, 8),
      item: new BoxGeometry(0.12, 0.12, 0.2),
      barrel: new BoxGeometry(0.05, 0.05, 0.26),
    }),
    []
  );

  const mats = useMemo(
    () => ({
      sleeve: new MeshStandardMaterial({ color: 0x33415a, roughness: 0.9 }),
      skin: new MeshStandardMaterial({ color: 0xdcae94, roughness: 0.6 }),
      item: new MeshStandardMaterial({ color: 0xcfd6df, roughness: 0.35, emissive: 0x223344, emissiveIntensity: 0.4 }),
    }),
    []
  );

  useEffect(() => {
    camera.add(root);
    if (!scene.children.includes(camera)) scene.add(camera);
    return () => {
      camera.remove(root);
    };
  }, [camera, scene, root]);

  useEffect(() => {
    return () => {
      for (const g of Object.values(geo)) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
    };
  }, [geo, mats]);

  useFrame((_, delta) => {
    const store = useSimulationStore.getState();
    const input = frameState.input;
    const visible = frameState.firstPerson && store.playerState === "on-foot" && !store.dialogue.active;
    root.visible = visible;
    if (!visible) return;

    if (input?.wasPressed(SimAction.Punch)) swing.current = 1;
    else swing.current = Math.max(0, swing.current - delta * 4.2);

    const t = frameState.clock.shaderTimeSeconds;
    const swayX = Math.sin(t * 2.1) * 0.008;
    const swayY = Math.cos(t * 2.7) * 0.006;
    const kick = swing.current * swing.current;

    root.position.set(
      REST_X + swayX - kick * 0.1,
      REST_Y + swayY - kick * 0.06 + swing.current * 0.16,
      REST_Z - kick * 0.08
    );
    root.rotation.set(-swing.current * 1.2, swing.current * 0.3, 0);

    const inv = useInventoryStore.getState();
    const slot = inv.slots[inv.selected];
    const def = slot ? ITEMS[slot.id] : undefined;
    if (def) {
      mats.item.color.set(def.color);
      mats.item.emissive.set(def.color);
      mats.item.emissiveIntensity = 0.55;
    } else {
      mats.item.emissiveIntensity = 0.15;
    }
  });

  return (
    <primitive object={root} visible={false}>
      {/* Forearm (sleeve) + fist, angled in from the lower right. */}
      <mesh geometry={geo.arm} material={mats.sleeve} position={[0.02, -0.2, 0.16]} rotation={[1.25, 0, 0.18]} />
      <mesh geometry={geo.fist} material={mats.skin} position={[0, 0.02, -0.02]} />
      {/* Held item, floating just past the fist. */}
      <group position={[0.01, 0.09, -0.14]}>
        <mesh geometry={geo.item} material={mats.item} />
        <mesh geometry={geo.barrel} material={mats.item} position={[0, 0.02, -0.2]} />
      </group>
    </primitive>
  );
}
