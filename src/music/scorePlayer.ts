import type { MusicClock } from "./clock";
import type { NotePlayer } from "./notePlayer";
import type { LoopScore } from "./score/pastoralLoop";

/** Plays the looping backing score in time with the clock's scheduling windows. */
export class ScorePlayer {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly clock: MusicClock,
    private readonly notes: NotePlayer,
    private readonly score: LoopScore,
  ) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.clock.onWindow((w) => {
      for (const point of w.grid(this.score.stepsPerBar)) {
        for (const n of this.score.notesAtStep(point.loopStep)) {
          this.notes.play({ ...n, timeBeats: point.beat, source: "score" });
        }
      }
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
