import { it, expect } from "vitest";
import { pastoralLoop, chordAtBeat } from "../../src/music/score/pastoralLoop";
import { pitchClass } from "../../src/music/theory";

it("progression Cm Cm Ab Ab Eb Eb Bb Bb", () =>
  expect([0, 1, 2, 3, 4, 5, 6, 7].map((b) => pastoralLoop.chordAtBar(b).name)).toEqual(["Cm", "Cm", "Ab", "Ab", "Eb", "Eb", "Bb", "Bb"]));
it("chordAtBeat wraps the 32-beat loop", () => {
  expect(chordAtBeat(pastoralLoop, 33).name).toBe("Cm");
  expect(chordAtBeat(pastoralLoop, -1).name).toBe("Bb");
});
it("bar start has cello, three violins and a harp note", () => {
  const n = pastoralLoop.notesAtStep(0);
  expect(n.filter((x) => x.instrument === "celloSection").map((x) => x.pitch)).toEqual([48]);
  expect(n.filter((x) => x.instrument === "violinSection").map((x) => x.pitch)).toEqual([67, 72, 75]);
  expect(n.filter((x) => x.instrument === "harp")).toEqual([{ instrument: "harp", pitch: 48, velocity: 0.6, durationBeats: 1.5 }]);
});
it("off-bar steps have only harp", () => {
  expect(pastoralLoop.notesAtStep(17)).toEqual([{ instrument: "harp", pitch: 51, velocity: 0.5, durationBeats: 1.5 }]);
});
it("every score pitch belongs to its bar's chord", () => {
  for (let s = 0; s < 64; s++) {
    const chord = pastoralLoop.chordAtBar(Math.floor(s / 8));
    for (const n of pastoralLoop.notesAtStep(s)) expect(chord.tones).toContain(pitchClass(n.pitch));
  }
});
