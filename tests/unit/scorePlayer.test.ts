import { it, expect } from "vitest";
import { ManualTickSource } from "@audiorective/clock";
import { MusicClock } from "../../src/music/clock";
import { NotePlayer } from "../../src/music/notePlayer";
import { ScorePlayer } from "../../src/music/scorePlayer";
import { EventLog } from "../../src/music/eventLog";
import { pastoralLoop } from "../../src/music/score/pastoralLoop";

it("plays exactly bar 1 of the loop in the first 2.35 s", () => {
  const ctx = { currentTime: 0 };
  const tickSource = new ManualTickSource();
  const clock = new MusicClock({ context: ctx, perceivedTime: () => ctx.currentTime, bpm: 96, beatsPerBar: 4, loopBars: 8, tickSource });
  const log = new EventLog(96, 4);
  const notes = new NotePlayer({ clock, context: ctx, instruments: {}, log });
  new ScorePlayer(clock, notes, pastoralLoop).start();
  clock.start();
  for (let t = 0; t <= 2.35 + 1e-9; t += 0.05) {
    ctx.currentTime = t;
    tickSource.tick();
  }
  const ev = log.events();
  const by = (i: string) => ev.filter((e) => e.instrument === i);
  expect(by("harp").map((e) => e.timeBeats)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  expect(by("celloSection")).toHaveLength(1);
  expect(by("violinSection")).toHaveLength(3);
  expect(ev.every((e) => e.source === "score")).toBe(true);
});
