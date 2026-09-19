/**
 * Procedural audio simulation (§33 "audio simulation" — implemented).
 *
 * Pure WebAudio synthesis — zero audio assets:
 *   wind   : looped noise → lowpass, level follows weather wind
 *   rain   : looped noise → bandpass, level follows weather rain
 *   engine : two detuned oscillators → lowpass, pitch/level follow speed
 *   thunder: noise burst → lowpass with slow decay (lightning strikes)
 *   blip   : short sine envelope (UI / interact)
 *
 * Autoplay policy: the context is created lazily on the first user gesture
 * (pointer/keyboard). All node handles are nullable; a suspended/failed
 * context degrades to silence, never an exception (§24). Mapping helpers
 * are pure and unit-tested.
 */

export interface AudioFrame {
  speedKmh: number;
  /** "driving" engages the engine voice; "flying" uses the ship voice. */
  mode: "on-foot" | "driving" | "flying";
  boost: number;
  wind: number;
  rain: number;
}

/** Pure mapping: engine pitch (Hz) from speed — monotonic, clamped. */
export function engineFrequency(speedKmh: number, mode: AudioFrame["mode"]): number {
  const base = mode === "flying" ? 58 : 42;
  const scale = mode === "flying" ? 0.62 : 1.15;
  return Math.min(220, base + Math.abs(speedKmh) * scale);
}

/** Pure mapping: engine loudness (0..1) from speed + boost. */
export function engineGain(speedKmh: number, boost: number, mode: AudioFrame["mode"]): number {
  if (mode === "on-foot") return 0;
  const idle = mode === "flying" ? 0.05 : 0.035;
  const speedNorm = Math.min(Math.abs(speedKmh) / 160, 1);
  return Math.min(0.22, idle + speedNorm * 0.1 + boost * 0.09);
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private engineGainNode: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineOscA: OscillatorNode | null = null;
  private engineOscB: OscillatorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private started = false;

  get isReady(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  /**
   * Create/resume the context. MUST be called from a user gesture handler
   * (browser autoplay policy); safe to call repeatedly.
   */
  resume(): void {
    try {
      if (this.ctx === null) {
        this.buildGraph();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        void this.ctx.resume().catch((err: unknown) => {
          console.warn("[audio] resume rejected:", err);
        });
      }
    } catch (err) {
      // Audio is an enhancement — never fatal (§24).
      console.warn("[audio] init failed, running silent:", err);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.08);
    }
  }

  /** Per-frame parameter update (call from the render loop). */
  update(frame: AudioFrame): void {
    const ctx = this.ctx;
    if (!ctx || !this.isReady) return;
    const t = ctx.currentTime;
    const smoothing = 0.12;
    this.windGain?.gain.setTargetAtTime(0.015 + frame.wind * 0.09, t, smoothing);
    this.rainGain?.gain.setTargetAtTime(frame.rain * 0.13, t, smoothing);
    const freq = engineFrequency(frame.speedKmh, frame.mode);
    const gain = engineGain(frame.speedKmh, frame.boost, frame.mode);
    this.engineOscA?.frequency.setTargetAtTime(freq, t, 0.09);
    this.engineOscB?.frequency.setTargetAtTime(freq * 1.007 + 2.1, t, 0.09);
    this.engineFilter?.frequency.setTargetAtTime(240 + freq * 5, t, 0.12);
    this.engineGainNode?.gain.setTargetAtTime(gain, t, smoothing);
  }

  /** Short UI blip (interact / dialogue advance). */
  blip(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
      osc.connect(gain).connect(this.master);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch (err) {
      console.warn("[audio] blip failed:", err);
    }
  }

  /** Thunder rumble (triggered by lightning strikes). */
  thunder(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer || this.muted) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 130;
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      src.connect(filter).connect(gain).connect(this.master);
      src.start();
      src.stop(t + 2.5);
      src.onended = () => {
        src.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    } catch (err) {
      console.warn("[audio] thunder failed:", err);
    }
  }

  /** Tear everything down (route unmount). */
  dispose(): void {
    try {
      this.engineOscA?.stop();
      this.engineOscB?.stop();
      void this.ctx?.close();
    } catch (err) {
      console.warn("[audio] dispose issue:", err);
    }
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.rainGain = null;
    this.engineGainNode = null;
    this.engineFilter = null;
    this.engineOscA = null;
    this.engineOscB = null;
    this.noiseBuffer = null;
    this.started = false;
  }

  /** Build the graph once. Called inside resume() within the try/catch. */
  private buildGraph(): void {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error("WebAudio unavailable in this browser");
    const ctx = new Ctor();
    this.ctx = ctx;

    // Shared 2 s pink-ish noise buffer for wind/rain/thunder voices.
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Cheap 2-pole lowpass passes for pink-ish character.
      b0 = 0.99765 * b0 + white * 0.099;
      b1 = 0.963 * b1 + white * 0.2965;
      b2 = 0.57 * b2 + white * 1.0526;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
    }
    this.noiseBuffer = buffer;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);

    // Wind voice.
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = buffer;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 380;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(windFilter).connect(this.windGain).connect(this.master);
    windSrc.start();

    // Rain voice.
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = buffer;
    rainSrc.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 1900;
    rainFilter.Q.value = 0.55;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSrc.connect(rainFilter).connect(this.rainGain).connect(this.master);
    rainSrc.start();

    // Engine voice: two detuned oscillators → lowpass.
    this.engineOscA = ctx.createOscillator();
    this.engineOscB = ctx.createOscillator();
    this.engineOscA.type = "sawtooth";
    this.engineOscB.type = "square";
    this.engineOscA.frequency.value = 42;
    this.engineOscB.frequency.value = 44;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 300;
    this.engineGainNode = ctx.createGain();
    this.engineGainNode.gain.value = 0;
    this.engineOscA.connect(this.engineFilter);
    this.engineOscB.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGainNode).connect(this.master);
    this.engineOscA.start();
    this.engineOscB.start();

    this.started = true;
    void this.started; // (flag kept for future lazy-voice logic)
  }
}

/** Application-wide audio facade. */
export const audio = new AudioSystem();
