import type { MusicClock, TimeSource } from "./clock";
import type { EventLog } from "./eventLog";
import type { InstrumentId, NoteRequest } from "./types";

export interface VoiceHandle {
  stop(when: number): void;
}

export interface InstrumentPort {
  play(n: { when: number; pitch: number; velocity: number; durationSec: number }): VoiceHandle | null;
}

export interface NotePlayerDeps {
  clock: Pick<MusicClock, "beatToTime" | "secondsPerBeat">;
  context: TimeSource;
  instruments: Partial<Record<InstrumentId, InstrumentPort>>;
  log: EventLog;
  warn?: (msg: string) => void;
}

/** Notes may never be scheduled in the past; this is how far ahead "now" is. */
const MIN_LEAD_SEC = 0.005;

/** Schedules note requests on instruments and records every one in the event log. */
export class NotePlayer {
  private readonly playing = new Map<number, { req: NoteRequest; voice: VoiceHandle | null }>();
  private readonly warned = new Set<InstrumentId>();

  constructor(private readonly deps: NotePlayerDeps) {}

  play(req: NoteRequest): number {
    const { clock, context, instruments, log } = this.deps;
    const id = log.record(req);
    const port = instruments[req.instrument];
    if (!port) {
      if (!this.warned.has(req.instrument)) {
        this.warned.add(req.instrument);
        this.deps.warn?.(`instrument "${req.instrument}" is not loaded; its notes are logged but silent`);
      }
      return id;
    }
    const when = Math.max(clock.beatToTime(req.timeBeats), context.currentTime + MIN_LEAD_SEC);
    const voice = port.play({ when, pitch: req.pitch, velocity: req.velocity, durationSec: req.durationBeats * clock.secondsPerBeat() });
    if (req.source === "player") this.playing.set(id, { req, voice });
    return id;
  }

  /** Cut a player note short (e.g. a jump released early). Never lengthens a note. */
  release(id: number, atBeat: number): void {
    const entry = this.playing.get(id);
    if (!entry) return;
    this.playing.delete(id);
    const newDuration = atBeat - entry.req.timeBeats;
    if (newDuration >= entry.req.durationBeats) return;
    const { clock, context, log } = this.deps;
    entry.voice?.stop(Math.max(clock.beatToTime(atBeat), context.currentTime + MIN_LEAD_SEC));
    log.amend(id, { durationBeats: Math.max(0, newDuration) });
  }
}
