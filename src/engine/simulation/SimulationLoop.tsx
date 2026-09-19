import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Fog } from "three";
import { MODE_GRAVITY, sampleTimeOfDay, type TimeOfDayOutput } from "./TimeOfDay";
import { integrateWetness, sampleWeather } from "./Weather";
import { GROUND_WET_UNIFORMS } from "@/shaders/terrain/wetUniforms";
import { frameState } from "@/state/transient/frameState";
import { useSettingsStore } from "@/state/stores/settingsStore";
import { physicsRuntime } from "@/engine/physics/PhysicsRuntime";

/**
 * Frame orchestrator (§5 render-loop architecture).
 *
 * Mounted FIRST inside the Canvas so its useFrame callback executes before
 * scene subsystems (R3F invokes subscribers in mount order):
 *
 *   INPUT poll → CLOCK advance → TIME-OF-DAY update → FOG/ENV sync →
 *   [scene useFrame callbacks + physics steps + entity transforms] →
 *   (render) → INPUT end-frame (InputFinalizer, mounted last)
 *
 * Per-frame allocations: none — the TimeOfDay adapter and fog object are
 * created once. React state: never touched.
 */
export function SimulationLoop(): null {
  const scene = useThree((s) => s.scene);

  const fog = useMemo(() => new Fog(0x9db8d2, 180, 2400), []);

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  // Adapter mapping frameState storage onto the TimeOfDay output contract.
  const todOut = useMemo<TimeOfDayOutput & { starOpacity: number }>(
    () => ({
      sunDirection: frameState.sunDirection,
      sunColor: frameState.sunColor,
      zenithColor: frameState.zenithColor,
      horizonColor: frameState.horizonColor,
      fogColor: frameState.fogColor,
      nightFactor: 0,
      sunIntensity: 0,
      rayleighStrength: 0,
      mieStrength: 0,
      starOpacity: 0,
    }),
    []
  );

  useFrame((_, delta) => {
    const input = frameState.input;
    if (input) input.update(); // gamepad poll + axis composition

    const settings = useSettingsStore.getState();
    frameState.clock.simulationRate = settings.simulationRate;
    frameState.clock.update(delta);
    frameState.clock.consumeFixedSteps();

    // Time of day advance (scaled, wrappable) + atmospheric sample.
    if (!settings.timeFrozen) {
      frameState.timeOfDay =
        (frameState.timeOfDay +
          delta * settings.timeScaleHoursPerSecond * settings.simulationRate + 24) % 24;
    }
    const lowG = settings.mode === "LOW_GRAVITY";
    sampleTimeOfDay(frameState.timeOfDay, todOut, {
      forcedPreset: lowG ? "turquoise" : undefined,
      nightBias: lowG ? 0.45 : undefined,
    });
    frameState.nightFactor = todOut.nightFactor;
    frameState.sunIntensity = todOut.sunIntensity;
    frameState.rayleighStrength = todOut.rayleighStrength;
    frameState.mieStrength = todOut.mieStrength;
    frameState.starOpacity = todOut.starOpacity;

    // --- Weather coupling (§33 procedural weather) -------------------------
    const wx = sampleWeather(frameState.clock.elapsedSeconds, settings.citySeed);
    const w = frameState.weather;
    w.cloudiness = wx.cloudiness;
    w.rain = wx.rain;
    w.windStrength = wx.windStrength;
    w.lightning = wx.lightning;
    w.wetness = integrateWetness(w.wetness, wx.rain, Math.min(delta, 0.1));
    GROUND_WET_UNIFORMS.u_wetness.value = w.wetness;
    // Overcast dimming: sun, stars, fog and sky hues shift toward slate grey.
    frameState.sunIntensity *= 1 - 0.72 * wx.cloudiness;
    frameState.starOpacity *= 1 - wx.cloudiness;
    frameState.zenithColor.lerp(OVERCAST_ZENITH, wx.cloudiness * 0.5);
    frameState.horizonColor.lerp(OVERCAST_HORIZON, wx.cloudiness * 0.5);
    frameState.fogColor.lerp(OVERCAST_HORIZON, wx.cloudiness * 0.42);
    frameState.mieStrength += 0.35 * wx.cloudiness;

    // Distance fog tracks the atmosphere; denser (closer) at night.
    fog.color.copy(frameState.fogColor);
    const cityScene = settings.mode !== "ORBITAL" && settings.mode !== "DEEP_SPACE";
    if (cityScene) {
      fog.near = 120 + 140 * (1 - frameState.nightFactor);
      fog.far = 900 + 1500 * (1 - frameState.nightFactor);
    } else {
      fog.near = 100000;
      fog.far = 400000;
    }

    // Diagnostics: EMA frame time + FPS (4th-gen EMA, cheap and stable).
    const frameMs = Math.min(delta * 1000, 1000);
    frameState.frameMs = frameState.frameMs * 0.92 + frameMs * 0.08;
    frameState.fps = 1000 / Math.max(frameState.frameMs, 0.01);

    // Renderer info reflects the LAST presented frame (autoReset disabled).
    const renderer = frameState.renderer;
    if (renderer) {
      frameState.render.drawCalls = renderer.info.render.calls;
      frameState.render.triangles = renderer.info.render.triangles;
      frameState.render.programs = renderer.info.programs?.length ?? 0;
      frameState.render.geometries = renderer.info.memory.geometries;
      frameState.render.textures = renderer.info.memory.textures;
    }

    // Live gravity mirror (mode changes / lab sliders).
    if (physicsRuntime.isBound) {
      physicsRuntime.setGravity(currentModeGravity());
    }

    if (!frameState.firstFrameRendered) {
      frameState.firstFrameRendered = true;
    }
  });

  return null;
}


// Overcast targets (preallocated scratch — §21 no per-frame allocation).
const OVERCAST_ZENITH = new Color(0.16, 0.18, 0.21);
const OVERCAST_HORIZON = new Color(0.32, 0.34, 0.38);

/** Live gravity for the active mode; the lab exposes per-axis control. */
function currentModeGravity(): { x: number; y: number; z: number } {
  const { mode, lab } = useSettingsStore.getState();
  if (mode === "LAB") return { x: lab.gravityX, y: lab.gravityY, z: lab.gravityZ };
  return MODE_GRAVITY[mode] ?? MODE_GRAVITY.METROPOLIS!;
}
