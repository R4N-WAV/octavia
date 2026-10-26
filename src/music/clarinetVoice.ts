import { C_MINOR, pitchesInRange, type Chord } from "./theory";

export interface VoiceNote {
  offsetBeats: number;
  pitch: number;
  durationBeats: number;
  velocity: number;
  articulation: "sus" | "stac";
}

export interface ClarinetVoiceOptions {
  scale: readonly number[];
  low: number;
  high: number;
  startPitch: number;
  rng: () => number;
}

export const CLARINET_DEFAULTS: Omit<ClarinetVoiceOptions, "rng"> = { scale: C_MINOR, low: 55, high: 79, startPitch: 67 };

interface Motif {
  steps: number[];
  offsets: number[];
  durations: number[];
}

// Scale-degree steps relative to the phrase's first note.
const MOTIFS: Motif[] = [
  { steps: [0, 1, 2], offsets: [0, 0.5, 1], durations: [0.5, 0.5, 1] },
  { steps: [0, -1, 0, 2], offsets: [0, 0.5, 1, 1.5], durations: [0.5, 0.5, 0.5, 1] },
  { steps: [2, 1, 0], offsets: [0, 0.5, 1], durations: [0.5, 0.5, 1.5] },
  { steps: [0, 2], offsets: [0, 1], durations: [1, 1] },
];

/** Chooses which notes Octavia's clarinet plays; the quantizer decides when. */
export class ClarinetVoice {
  private last: number;
  private lastMotif = -1;

  constructor(private readonly opts: ClarinetVoiceOptions) {
    this.last = opts.startPitch;
  }

  get lastPitch(): number {
    return this.last;
  }

  jump(chord: Chord): VoiceNote {
    const up = this.chordPitches(chord).filter((p) => p - this.last >= 3 && p - this.last <= 9);
    const pitch = up.length ? up[0]! : this.nearest(this.chordPitches(chord), (this.opts.low + this.opts.high) / 2);
    return this.note(pitch, 1, 0.75, "sus");
  }

  land(chord: Chord, impact: number): VoiceNote {
    const down = this.chordPitches(chord).filter((p) => this.last - p >= 1 && this.last - p <= 7);
    const pitch = down.length ? down[down.length - 1]! : this.nearest(this.chordPitches(chord), this.last);
    const i = Math.min(1, Math.max(0, impact));
    return this.note(pitch, 0.5, 0.5 + 0.4 * i, "stac");
  }

  pickup(chord: Chord): VoiceNote {
    return this.note(this.nearest(this.chordPitches(chord), this.last), 0.5, 0.55, "stac");
  }

  runPhrase(chord: Chord): VoiceNote[] {
    let m = Math.floor(this.opts.rng() * (MOTIFS.length - (this.lastMotif >= 0 ? 1 : 0)));
    if (this.lastMotif >= 0 && m >= this.lastMotif) m++;
    this.lastMotif = m;
    const motif = MOTIFS[m]!;

    const scale = pitchesInRange(this.opts.scale, this.opts.low, this.opts.high);
    const start = scale.indexOf(this.nearest(this.chordPitches(chord), this.last));
    const max = scale.length - 1;
    const reflect = (i: number) => (i < 0 ? -i : i > max ? 2 * max - i : i);

    const notes = motif.steps.map((step, k) => ({
      offsetBeats: motif.offsets[k]!,
      pitch: scale[reflect(start + step)]!,
      durationBeats: motif.durations[k]!,
      velocity: 0.55,
      articulation: "sus" as const,
    }));
    this.last = notes[notes.length - 1]!.pitch;
    return notes;
  }

  private chordPitches(chord: Chord): number[] {
    return pitchesInRange(chord.tones, this.opts.low, this.opts.high);
  }

  /** Closest pitch to target; ties go to the lower pitch. */
  private nearest(pitches: number[], target: number): number {
    let best = pitches[0]!;
    for (const p of pitches) if (Math.abs(p - target) < Math.abs(best - target)) best = p;
    return best;
  }

  private note(pitch: number, durationBeats: number, velocity: number, articulation: "sus" | "stac"): VoiceNote {
    this.last = pitch;
    return { offsetBeats: 0, pitch, durationBeats, velocity, articulation };
  }
}
