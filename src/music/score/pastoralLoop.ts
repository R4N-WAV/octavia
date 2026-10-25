import type { InstrumentId } from "../types";
import { CHORDS, type Chord } from "../theory";

export interface ScoreNote {
  instrument: InstrumentId;
  pitch: number;
  velocity: number;
  durationBeats: number;
}

export interface LoopScore {
  bpm: number;
  beatsPerBar: number;
  bars: number;
  stepsPerBar: number;
  chordAtBar(bar: number): Chord;
  notesAtStep(loopStep: number): ScoreNote[];
}

interface BarSpec {
  chord: Chord;
  cello: number;
  violins: number[];
  harp: number[];
}

// Two bars per chord: Cm - Ab - Eb - Bb.
const SPECS: BarSpec[] = [
  { chord: CHORDS.Cm, cello: 48, violins: [67, 72, 75], harp: [48, 55, 60, 63, 67, 63, 60, 55] },
  { chord: CHORDS.Ab, cello: 44, violins: [68, 72, 75], harp: [44, 51, 56, 60, 63, 60, 56, 51] },
  { chord: CHORDS.Eb, cello: 51, violins: [67, 70, 75], harp: [51, 58, 63, 67, 70, 67, 63, 58] },
  { chord: CHORDS.Bb, cello: 46, violins: [65, 70, 74], harp: [46, 53, 58, 62, 65, 62, 58, 53] },
];

const BARS = 8;
const STEPS_PER_BAR = 8;
const LOOP_STEPS = BARS * STEPS_PER_BAR;
const mod = (n: number, m: number) => ((n % m) + m) % m;
const specAtBar = (bar: number): BarSpec => SPECS[Math.floor(mod(bar, BARS) / 2)]!;

export const pastoralLoop: LoopScore = {
  bpm: 96,
  beatsPerBar: 4,
  bars: BARS,
  stepsPerBar: STEPS_PER_BAR,
  chordAtBar: (bar) => specAtBar(bar).chord,
  notesAtStep(loopStep) {
    const s = mod(loopStep, LOOP_STEPS);
    const bar = Math.floor(s / STEPS_PER_BAR);
    const inBar = s % STEPS_PER_BAR;
    const spec = specAtBar(bar);
    const notes: ScoreNote[] = [];
    if (inBar === 0) {
      notes.push({ instrument: "celloSection", pitch: spec.cello, velocity: 0.5, durationBeats: 4 });
      for (const p of spec.violins) notes.push({ instrument: "violinSection", pitch: p, velocity: 0.45, durationBeats: 4 });
    }
    notes.push({ instrument: "harp", pitch: spec.harp[inBar]!, velocity: inBar === 0 ? 0.6 : 0.5, durationBeats: 1.5 });
    return notes;
  },
};

export function chordAtBeat(score: LoopScore, beat: number): Chord {
  return score.chordAtBar(mod(Math.floor(beat / score.beatsPerBar), score.bars));
}
