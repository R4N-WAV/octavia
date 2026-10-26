export type PlayerAnim = "idle" | "run" | "rise" | "fall" | "land";

export const RUN_FRAMES = 8;
export const LAND_ANIM_MS = 80;

/** Two footsteps per beat: contact frames 0 and 4 land on eighth notes. */
export function runFrameAtBeat(beat: number): number {
  const frac = beat - Math.floor(beat);
  return Math.min(RUN_FRAMES - 1, Math.floor(frac * RUN_FRAMES));
}

export function chooseAnim(s: { grounded: boolean; vx: number; vy: number; msSinceLanding: number }): PlayerAnim {
  if (!s.grounded) return s.vy < 0 ? "rise" : "fall";
  if (s.msSinceLanding < LAND_ANIM_MS) return "land";
  return Math.abs(s.vx) > 10 ? "run" : "idle";
}
