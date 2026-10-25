import { it, expect } from "vitest";
import { C_MINOR, CHORDS, pitchClass, pitchesInRange } from "../../src/music/theory";
import { mulberry32 } from "../../src/music/rng";

it("C minor scale", () => expect([...C_MINOR]).toEqual([0, 2, 3, 5, 7, 8, 10]));
it("pitchesInRange lists chord tones ascending", () =>
  expect(pitchesInRange(CHORDS.Cm.tones, 55, 67)).toEqual([55, 60, 63, 67]));
it("pitchClass handles any octave", () => expect(pitchClass(70)).toBe(10));
it("mulberry32 is deterministic", () => {
  const a = mulberry32(7), b = mulberry32(7);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});
