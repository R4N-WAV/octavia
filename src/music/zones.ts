import type { InstrumentId } from "./types";

export interface SampleZone {
  midi: number;
  url: string;
}

export interface SampleManifest {
  instruments: Record<InstrumentId, SampleZone[]>;
}

/** Nearest sampled pitch (ties → the higher zone, so it is pitched down) and the playback rate to reach `pitch`. */
export function pickZone(zones: readonly { midi: number }[], pitch: number): { index: number; rate: number } {
  let index = 0;
  zones.forEach((z, i) => {
    const d = Math.abs(z.midi - pitch);
    const best = Math.abs(zones[index]!.midi - pitch);
    if (d < best || (d === best && z.midi > zones[index]!.midi)) index = i;
  });
  return { index, rate: 2 ** ((pitch - zones[index]!.midi) / 12) };
}

export function velocityToGain(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return 0.2 + 0.8 * c * c;
}
