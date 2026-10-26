import { it, expect } from "vitest";
// @ts-expect-error plain JS helper module
import { parseNoteName, noteToMidi, pickPreferred } from "../../scripts/sampleNames.mjs";

it("parses both naming styles", () => {
  expect(parseNoteName("DCClar_susLong_A#3_v2_rr1_sum.wav")).toEqual({ name: "A#", octave: 3 });
  expect(parseNoteName("KSHarp_E1_f.wav")).toEqual({ name: "E", octave: 1 });
  expect(parseNoteName("susvib_C1_v1_1.wav")).toEqual({ name: "C", octave: 1 });
  expect(parseNoteName("LICENSE")).toBeNull();
});
it("noteToMidi", () => {
  expect(noteToMidi("A", 4, 0)).toBe(69);
  expect(noteToMidi("C", 3, 1)).toBe(60);
});
it("pickPreferred keeps one file per pitch and honours preference order", () => {
  const files = ["x/D2_v1_rr1.wav", "x/D2_v2_rr1.wav", "x/D2_v2_rr2.wav", "x/F2_v1_rr1.wav"].map((f) => f.replace("x/", "x/Clar_"));
  expect(pickPreferred(files, ["_v2_rr1", "_v1_rr1"])).toEqual(["x/Clar_D2_v2_rr1.wav", "x/Clar_F2_v1_rr1.wav"]);
});
