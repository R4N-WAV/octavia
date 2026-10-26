import { Clock, LinearBarRuler, Timeline, type TickSource } from "@audiorective/clock";

export interface TimeSource {
  readonly currentTime: number;
}

export interface GridPoint {
  beat: number;
  time: number;
  /** Step number counted from beat 0, increasing forever. */
  index: number;
  /** Step within the loop (floored modulo stepsPerBar × loopBars). */
  loopStep: number;
}

export interface MusicWindow {
  generation: number;
  grid(stepsPerBar: number): GridPoint[];
}

export interface MusicClockOptions {
  context: TimeSource;
  perceivedTime: () => number;
  bpm: number;
  beatsPerBar: number;
  loopBars: number;
  tickSource?: TickSource;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Musical time on the audio clock: tempo, beat ↔ seconds, look-ahead scheduling windows. */
export class MusicClock {
  readonly beatsPerBar: number;
  readonly loopBars: number;
  private readonly timeline;
  private readonly clock;
  private readonly listeners = new Set<(w: MusicWindow) => void>();

  constructor(private readonly opts: MusicClockOptions) {
    this.beatsPerBar = opts.beatsPerBar;
    this.loopBars = opts.loopBars;
    this.timeline = new Timeline({ audioContext: opts.context, bpm: opts.bpm }).addRuler(
      "bar",
      new LinearBarRuler({ numerator: opts.beatsPerBar, denominator: 4 }),
    );
    this.clock = new Clock({
      timeline: this.timeline,
      tickSource: opts.tickSource,
      onTick: (w) => {
        const win: MusicWindow = {
          generation: w.generation,
          grid: (stepsPerBar) =>
            [...w.rulers.bar.grid(stepsPerBar)].map((p) => ({
              beat: p.beat,
              time: p.time,
              index: p.index,
              loopStep: mod(p.index, stepsPerBar * this.loopBars),
            })),
        };
        for (const l of this.listeners) l(win);
      },
    });
  }

  start(): void {
    this.clock.start();
  }
  pause(): void {
    this.clock.pause();
  }
  resume(): void {
    this.clock.resume();
  }

  get bpm(): number {
    return this.timeline.bpm.valueAtTime(this.opts.context.currentTime);
  }
  setBpm(bpm: number): void {
    this.timeline.bpm.setValueAtTime(bpm, this.opts.context.currentTime);
  }
  secondsPerBeat(): number {
    return 60 / this.bpm;
  }

  beatToTime(beat: number): number {
    return this.timeline.beatToTime(beat);
  }
  timeToBeat(time: number): number {
    return this.timeline.timeToBeat(time);
  }
  /** The beat the listener is hearing right now (output latency accounted for). */
  perceivedBeat(): number {
    return this.timeline.timeToBeat(this.opts.perceivedTime());
  }

  onWindow(listener: (w: MusicWindow) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export type BeatEvent = { kind: "beat"; beatIndex: number } | { kind: "bar"; barIndex: number; beatIndex: number };

/** Turns a continuous beat position into beat/bar events, once per beat. */
export class BeatTracker {
  private last: number | null = null;

  constructor(private readonly beatsPerBar: number) {}

  update(beat: number): BeatEvent[] {
    const cur = Math.floor(beat + 1e-9);
    if (this.last === null || cur < this.last) {
      this.last = cur;
      return [];
    }
    if (cur === this.last) return [];
    // After a long gap (hidden tab), only report where we are now: no burst of backlog pulses.
    const from = cur - this.last > 4 ? cur : this.last + 1;
    const out: BeatEvent[] = [];
    for (let b = from; b <= cur; b++) {
      out.push({ kind: "beat", beatIndex: b });
      if (mod(b, this.beatsPerBar) === 0) out.push({ kind: "bar", barIndex: b / this.beatsPerBar, beatIndex: b });
    }
    this.last = cur;
    return out;
  }
}

/** Audio-clock time (as heard) of an input event that happened at `eventMs` (performance.now() based). */
export function heardTimeOfInput(eventMs: number, nowMs: number, perceivedNowSec: number): number {
  return perceivedNowSec - (nowMs - eventMs) / 1000;
}
