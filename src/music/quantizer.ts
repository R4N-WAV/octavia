export type Subdivision = "quarter" | "eighth" | "sixteenth" | "eighthTriplet" | "sixteenthTriplet" | "thirtySecond";

export const SUBDIVISION_BEATS: Record<Subdivision, number> = {
  quarter: 1,
  eighth: 1 / 2,
  sixteenth: 1 / 4,
  eighthTriplet: 1 / 3,
  sixteenthTriplet: 1 / 6,
  thirtySecond: 1 / 8,
};

export const ALL_SUBDIVISIONS: readonly Subdivision[] = [
  "quarter",
  "eighth",
  "sixteenth",
  "eighthTriplet",
  "sixteenthTriplet",
  "thirtySecond",
];

export enum Strength {
  ThirtySecond = 0,
  SixteenthTriplet = 1,
  Sixteenth = 2,
  EighthTriplet = 3,
  Eighth = 4,
  Beat = 5,
  Bar = 6,
}

export interface QuantizeRules {
  lateGraceSec: number;
  strongPullSec: number;
}

export const DEFAULT_RULES: QuantizeRules = { lateGraceSec: 0.03, strongPullSec: 0.04 };

export type SnapMode = "grace" | "pull" | "forward";

export interface SnapResult {
  beat: number;
  strength: Strength;
  mode: SnapMode;
}

const EPS = 1e-6;
const isMultiple = (x: number, step: number) => Math.abs(x / step - Math.round(x / step)) < EPS;

export function strengthAt(beat: number, beatsPerBar: number): Strength {
  if (isMultiple(beat, beatsPerBar)) return Strength.Bar;
  if (isMultiple(beat, 1)) return Strength.Beat;
  if (isMultiple(beat, 1 / 2)) return Strength.Eighth;
  if (isMultiple(beat, 1 / 3)) return Strength.EighthTriplet;
  if (isMultiple(beat, 1 / 4)) return Strength.Sixteenth;
  if (isMultiple(beat, 1 / 6)) return Strength.SixteenthTriplet;
  return Strength.ThirtySecond;
}

/**
 * Snap an input moment (in beats) to a grid point.
 * Rules, in order: late grace (play now, log on the point just passed),
 * strong-point pull (a strong point is just ahead), nearest point ahead.
 */
export function quantize(
  inputBeat: number,
  secPerBeat: number,
  grid: readonly Subdivision[],
  beatsPerBar: number,
  rules: QuantizeRules = DEFAULT_RULES,
): SnapResult {
  const graceBeats = rules.lateGraceSec / secPerBeat;
  const pullBeats = rules.strongPullSec / secPerBeat;

  let prev = -Infinity;
  const nexts: number[] = [];
  for (const sub of grid) {
    const step = SUBDIVISION_BEATS[sub];
    const k = Math.floor(inputBeat / step + 1e-9);
    prev = Math.max(prev, k * step);
    nexts.push((k + 1) * step);
  }

  const done = (beat: number, mode: SnapMode): SnapResult => ({ beat, strength: strengthAt(beat, beatsPerBar), mode });

  if (inputBeat - prev <= graceBeats + 1e-9) return done(prev, "grace");

  const pulls = nexts
    .filter((p) => p - inputBeat <= pullBeats + 1e-9 && strengthAt(p, beatsPerBar) >= Strength.Eighth)
    .sort((a, b) => a - b);
  if (pulls.length > 0) return done(pulls[0]!, "pull");

  return done(Math.min(...nexts), "forward");
}
