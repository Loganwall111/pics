/**
 * LUMITAL audio (§audio) — fully synthesized WebAudio, no files.
 *
 * One shared AudioContext (created lazily on the first user gesture):
 *  - ambient pad per world: two detuned oscillators → lowpass → slow LFO'd
 *    gain (each world has its own base frequency/mood)
 *  - blips: pickup (sine), portal (glide), evolve (up-chirp), colony (chord)
 *  - master mute (M)
 */

type Ctx = AudioContext;

class LumitalAudio {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private padGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];
  private padFilter: BiquadFilterNode | null = null;
  muted = false;

  /** Call from any click/keydown (autoplay policy). */
  resume(): void {
    if (!this.ctx) {
      const AC = window.AudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    }
  }

  /** Crossfade the ambient bed to a world's base frequency (Hz). */
  setWorld(baseHz: number): void {
    if (!this.ctx || !this.master) return;
    // Tear down the previous pad.
    for (const osc of this.padOscs) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.padOscs = [];
    if (this.padGain) {
      this.padGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    }

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 1.2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = baseHz * 6;
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    oscA.type = "sawtooth";
    oscB.type = "sawtooth";
    oscA.frequency.value = baseHz;
    oscB.frequency.value = baseHz * 1.008; // slow beat
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    // Slow breathing LFO on the pad loudness.
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    oscA.start();
    oscB.start();
    lfo.start();
    this.padOscs = [oscA, oscB, lfo];
    this.padGain = gain;
    this.padFilter = filter;
    void this.padFilter;
  }

  private tone(freq: number, toFreq: number, duration: number, type: OscillatorType, level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq), ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(level, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.03);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  pickup(): void {
    this.tone(660, 990, 0.12, "sine", 0.14);
  }
  portal(): void {
    this.tone(180, 1400, 0.7, "sawtooth", 0.1);
  }
  evolve(): void {
    this.tone(330, 1320, 0.35, "triangle", 0.16);
  }
  colony(): void {
    this.tone(220, 220, 0.5, "sine", 0.12);
    this.tone(330, 330, 0.5, "sine", 0.1);
  }
}

export const lumitalAudio = new LumitalAudio();

/** Ambient base frequency per world id (mood picking, pure). */
export function worldBaseHz(world: string): number {
  switch (world) {
    case "ocean":
      return 82;
    case "microscopic":
      return 196;
    case "alienrain":
      return 73;
    case "maze":
      return 130;
    case "blackhole":
      return 55;
    default:
      return 110; // void
  }
}
