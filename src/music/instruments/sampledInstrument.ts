import { AudioProcessor, Sampler, type AudioBufferCache, type SchedulableParam } from "@audiorective/core";
import type { InstrumentPort, VoiceHandle } from "../notePlayer";
import type { InstrumentId } from "../types";
import { pickZone, velocityToGain, type SampleZone } from "../zones";

export interface SampledInstrumentOptions {
  volume: number;
  fadeIn: number;
  fadeOut: number;
  polyphonyPerZone: number;
}

export const INSTRUMENT_SETTINGS: Record<InstrumentId, SampledInstrumentOptions> = {
  clarinetSus: { volume: 0.9, fadeIn: 0.01, fadeOut: 0.12, polyphonyPerZone: 3 },
  clarinetStac: { volume: 0.85, fadeIn: 0, fadeOut: 0.05, polyphonyPerZone: 3 },
  harp: { volume: 0.6, fadeIn: 0, fadeOut: 0.4, polyphonyPerZone: 4 },
  celloSection: { volume: 0.45, fadeIn: 0.25, fadeOut: 0.6, polyphonyPerZone: 2 },
  violinSection: { volume: 0.35, fadeIn: 0.3, fadeOut: 0.6, polyphonyPerZone: 3 },
};

/** A multi-sampled instrument: one Sampler per recorded pitch, pitch-shifted to the nearest zone. */
export class SampledInstrument extends AudioProcessor<{ volume: SchedulableParam }> implements InstrumentPort {
  private readonly out: GainNode;
  private readonly samplers: Sampler[];

  private constructor(
    ctx: BaseAudioContext,
    private readonly zones: SampleZone[],
    buffers: AudioBuffer[],
    opts: SampledInstrumentOptions,
  ) {
    const gain = new GainNode(ctx);
    super(ctx, ({ param }) => ({ params: { volume: param({ default: opts.volume, bind: gain.gain }) } }));
    this.out = gain;
    this.samplers = buffers.map((buffer) => {
      const s = new Sampler(ctx, { buffer, polyphony: opts.polyphonyPerZone, steal: "oldest", fadeIn: opts.fadeIn, fadeOut: opts.fadeOut });
      s.output.connect(gain);
      return s;
    });
  }

  /** Loads every zone; a zone that fails to load or decode is skipped (its neighbours cover it). */
  static async load(ctx: BaseAudioContext, cache: AudioBufferCache, zones: SampleZone[], opts: SampledInstrumentOptions): Promise<SampledInstrument> {
    const results = await Promise.allSettled(zones.map((z) => cache.load(z.url)));
    const ok = results.flatMap((r, i) => (r.status === "fulfilled" ? [{ zone: zones[i]!, buffer: r.value }] : []));
    results.forEach((r, i) => r.status === "rejected" && console.warn(`sample ${zones[i]!.url} skipped:`, r.reason));
    if (ok.length === 0) throw new Error("no samples could be loaded");
    return new SampledInstrument(ctx, ok.map((o) => o.zone), ok.map((o) => o.buffer), opts);
  }

  get output(): AudioNode {
    return this.out;
  }

  play(n: { when: number; pitch: number; velocity: number; durationSec: number }): VoiceHandle | null {
    if (this.zones.length === 0) return null;
    const { index, rate } = pickZone(this.zones, n.pitch);
    const voice = this.samplers[index]!.trigger({ when: n.when, rate, volume: velocityToGain(n.velocity) });
    if (!voice) return null;
    voice.stop(n.when + n.durationSec);
    return { stop: (when) => voice.stop(when) };
  }

  override destroy(): void {
    for (const s of this.samplers) s.destroy();
    super.destroy();
  }
}
