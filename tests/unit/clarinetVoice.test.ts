import { it, expect } from "vitest";
import { ClarinetVoice, CLARINET_DEFAULTS } from "../../src/music/clarinetVoice";
import { CHORDS, C_MINOR, pitchClass } from "../../src/music/theory";
import { mulberry32 } from "../../src/music/rng";

const voice = (startPitch = 67, seed = 1) => new ClarinetVoice({ ...CLARINET_DEFAULTS, startPitch, rng: mulberry32(seed) });

it("jump goes up to a chord tone", () => {
  const n = voice(67).jump(CHORDS.Cm); // G4 → C5
  expect(n).toMatchObject({ pitch: 72, articulation: "sus", durationBeats: 1, velocity: 0.75 });
});
it("land goes down to a chord tone", () => {
  const n = voice(72).land(CHORDS.Cm, 1); // C5 → G4
  expect(n).toMatchObject({ pitch: 67, articulation: "stac", durationBeats: 0.5 });
  expect(n.velocity).toBeCloseTo(0.9, 9);
});
it("pickup is the nearest chord tone", () => expect(voice(66).pickup(CHORDS.Eb).pitch).toBe(67));
it("run phrase has 2–4 notes with increasing offsets, all in C minor", () => {
  const notes = voice().runPhrase(CHORDS.Ab);
  expect(notes.length).toBeGreaterThanOrEqual(2);
  expect(notes.length).toBeLessThanOrEqual(4);
  for (let i = 1; i < notes.length; i++) expect(notes[i]!.offsetBeats).toBeGreaterThan(notes[i - 1]!.offsetBeats);
  for (const n of notes) expect(C_MINOR).toContain(pitchClass(n.pitch));
});
it("never repeats a motif twice in a row", () => {
  const v = voice(67, 3);
  let prev = "";
  for (let i = 0; i < 20; i++) {
    const shape = v.runPhrase(CHORDS.Cm).map((n) => `${n.offsetBeats}/${n.durationBeats}`).join(",");
    expect(shape).not.toBe(prev);
    prev = shape;
  }
});
it("10 000 random actions stay in range 55–79 and in scale", () => {
  const v = voice(67, 9);
  const rnd = mulberry32(42);
  const chords = [CHORDS.Cm, CHORDS.Ab, CHORDS.Eb, CHORDS.Bb];
  for (let i = 0; i < 10000; i++) {
    const chord = chords[Math.floor(i / 7) % 4]!;
    const r = rnd();
    const notes = r < 0.3 ? [v.jump(chord)] : r < 0.6 ? [v.land(chord, rnd())] : r < 0.8 ? [v.pickup(chord)] : v.runPhrase(chord);
    for (const n of notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(55);
      expect(n.pitch).toBeLessThanOrEqual(79);
      expect(C_MINOR).toContain(pitchClass(n.pitch));
    }
  }
});
it("jump from the top of the range falls back near the middle", () => {
  const p = voice(79).jump(CHORDS.Cm).pitch;
  expect(Math.abs(p - 67)).toBeLessThanOrEqual(3);
});
