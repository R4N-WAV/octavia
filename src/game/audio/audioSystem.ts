import { AudioBufferCache, createEngine } from "@audiorective/core";
import { MusicClock } from "../../music/clock";
import { EventLog } from "../../music/eventLog";
import { NotePlayer, type InstrumentPort } from "../../music/notePlayer";
import { ScorePlayer } from "../../music/scorePlayer";
import { pastoralLoop } from "../../music/score/pastoralLoop";
import { INSTRUMENT_SETTINGS, SampledInstrument } from "../../music/instruments/sampledInstrument";
import type { SampleManifest } from "../../music/zones";
import type { InstrumentId } from "../../music/types";

export type AudioStatus = "pending" | "loading" | "running" | "silent";

const BACKING: InstrumentId[] = ["harp", "celloSection", "violinSection"];

/**
 * Owns the audio engine. `start()` must be called from a tap/click/key handler
 * (browsers only allow sound after a user gesture). Until the music is running,
 * `beat()` follows the wall clock so animation keeps time either way.
 */
export class AudioSystem {
  status: AudioStatus = "pending";
  log = new EventLog(pastoralLoop.bpm, pastoralLoop.beatsPerBar);
  private clock: MusicClock | null = null;
  private ctx: AudioContext | null = null;

  beat(): number {
    if (this.clock && this.status === "running") return this.clock.perceivedBeat();
    return (performance.now() / 1000) * (pastoralLoop.bpm / 60);
  }

  start(opts: { silent?: boolean } = {}): void {
    if (this.status !== "pending") return;
    if (opts.silent) {
      this.status = "silent";
      return;
    }
    let engine;
    try {
      engine = createEngine(() => ({}));
    } catch (e) {
      console.warn("Audio unavailable:", e);
      this.status = "silent";
      return;
    }
    this.status = "loading";
    void engine.core.start(); // must run inside the gesture handler
    void this.load(engine.core.context).catch((e) => {
      console.warn("Music could not start:", e);
      this.status = "silent";
    });
  }

  private async load(ctx: AudioContext): Promise<void> {
    this.ctx = ctx;
    const manifest = (await (await fetch("assets/audio/samples/manifest.json")).json()) as SampleManifest;
    const cache = new AudioBufferCache(ctx);
    const instruments: Partial<Record<InstrumentId, InstrumentPort>> = {};
    await Promise.all(
      BACKING.map(async (id) => {
        try {
          const inst = await SampledInstrument.load(ctx, cache, manifest.instruments[id], INSTRUMENT_SETTINGS[id]);
          inst.output.connect(ctx.destination);
          instruments[id] = inst;
        } catch (e) {
          console.warn(`Instrument ${id} failed to load:`, e);
        }
      }),
    );

    const perceivedTime = () => ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    const clock = new MusicClock({ context: ctx, perceivedTime, bpm: pastoralLoop.bpm, beatsPerBar: pastoralLoop.beatsPerBar, loopBars: pastoralLoop.bars });
    const notes = new NotePlayer({ clock, context: ctx, instruments, log: this.log, warn: (m) => console.warn(m) });
    new ScorePlayer(clock, notes, pastoralLoop).start();
    clock.start();
    this.clock = clock;
    this.status = "running";

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clock.pause();
        void ctx.suspend();
      } else {
        void ctx.resume().then(() => clock.resume());
      }
    });
  }
}

export const audioSystem = new AudioSystem();
