export const C_MINOR: readonly number[] = [0, 2, 3, 5, 7, 8, 10];

export interface Chord {
  name: string;
  root: number;
  tones: readonly number[];
}

export const CHORDS = {
  Cm: { name: "Cm", root: 0, tones: [0, 3, 7] },
  Ab: { name: "Ab", root: 8, tones: [8, 0, 3] },
  Eb: { name: "Eb", root: 3, tones: [3, 7, 10] },
  Bb: { name: "Bb", root: 10, tones: [10, 2, 5] },
} as const satisfies Record<string, Chord>;

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function pitchesInRange(pcs: readonly number[], low: number, high: number): number[] {
  const out: number[] = [];
  for (let m = low; m <= high; m++) if (pcs.includes(pitchClass(m))) out.push(m);
  return out;
}
