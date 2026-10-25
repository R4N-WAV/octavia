import { it, expect } from "vitest";
import { EventLog } from "../../src/music/eventLog";
import type { NoteRequest } from "../../src/music/types";

const req = (over: Partial<NoteRequest> = {}): NoteRequest => ({
  timeBeats: 1, durationBeats: 1, instrument: "clarinetSus", pitch: 67, velocity: 0.7, source: "player", action: "jump", ...over,
});

it("records every field and assigns increasing ids", () => {
  const log = new EventLog(96, 4);
  expect(log.record(req())).toBe(1);
  expect(log.record(req({ pitch: 70 }))).toBe(2);
  expect(log.events()[0]).toEqual({ ...req(), id: 1 });
});
it("amend changes duration only", () => {
  const log = new EventLog(96, 4);
  const id = log.record(req());
  log.amend(id, { durationBeats: 0.25 });
  expect(log.events()[0]).toEqual({ ...req({ durationBeats: 0.25 }), id });
});
it("amend on unknown id is a no-op", () => {
  const log = new EventLog(96, 4);
  log.record(req());
  log.amend(99, { durationBeats: 5 });
  expect(log.events()[0]!.durationBeats).toBe(1);
});
it("toJSON includes bpm, beatsPerBar and a copy of events", () => {
  const log = new EventLog(96, 4);
  log.record(req());
  const json = log.toJSON();
  expect(json.bpm).toBe(96);
  expect(json.beatsPerBar).toBe(4);
  json.events[0]!.pitch = 1;
  expect(log.events()[0]!.pitch).toBe(67);
});
it("clear empties events but keeps the id counter increasing", () => {
  const log = new EventLog(96, 4);
  log.record(req());
  log.clear();
  expect(log.events()).toHaveLength(0);
  expect(log.record(req())).toBe(2);
});
