import { it, expect } from "vitest";
import { NotePlayer, type InstrumentPort } from "../../src/music/notePlayer";
import { EventLog } from "../../src/music/eventLog";
import type { NoteRequest } from "../../src/music/types";

function setup(currentTime = 0) {
  const calls: { when: number; pitch: number; velocity: number; durationSec: number }[] = [];
  const stops: number[] = [];
  const port: InstrumentPort = { play: (n) => (calls.push(n), { stop: (w) => stops.push(w) }) };
  const ctx = { currentTime };
  const log = new EventLog(96, 4);
  const warnings: string[] = [];
  const notes = new NotePlayer({
    clock: { beatToTime: (b) => b * 0.625, secondsPerBeat: () => 0.625 },
    context: ctx,
    instruments: { clarinetSus: port },
    log,
    warn: (m) => warnings.push(m),
  });
  return { calls, stops, ctx, log, notes, warnings };
}
const req = (o: Partial<NoteRequest> = {}): NoteRequest => ({
  timeBeats: 4, durationBeats: 1, instrument: "clarinetSus", pitch: 67, velocity: 0.7, source: "player", action: "jump", ...o,
});

it("schedules at the beat's time and logs the request", () => {
  const { calls, log, notes } = setup();
  const id = notes.play(req());
  expect(calls[0]).toEqual({ when: 2.5, pitch: 67, velocity: 0.7, durationSec: 0.625 });
  expect(log.events()[0]).toEqual({ ...req(), id });
});
it("clamps past times to just after now", () => {
  const { calls, notes } = setup(1);
  notes.play(req({ timeBeats: 0 }));
  expect(calls[0]!.when).toBeCloseTo(1.005, 9);
});
it("durationSec = durationBeats × secondsPerBeat", () => {
  const { calls, notes } = setup();
  notes.play(req({ durationBeats: 2 }));
  expect(calls[0]!.durationSec).toBeCloseTo(1.25, 9);
});
it("release stops the voice and shortens the logged duration", () => {
  const { stops, log, notes } = setup();
  const id = notes.play(req());
  notes.release(id, 4.25);
  expect(stops).toEqual([2.65625]);
  expect(log.events()[0]!.durationBeats).toBe(0.25);
});
it("release never lengthens", () => {
  const { stops, log, notes } = setup();
  const id = notes.play(req());
  notes.release(id, 6);
  expect(stops).toEqual([]);
  expect(log.events()[0]!.durationBeats).toBe(1);
});
it("missing instrument is skipped and logged once", () => {
  const { calls, log, notes, warnings } = setup();
  notes.play(req({ instrument: "harp" }));
  notes.play(req({ instrument: "harp" }));
  expect(calls).toHaveLength(0);
  expect(log.events()).toHaveLength(2);
  expect(warnings).toHaveLength(1);
});
