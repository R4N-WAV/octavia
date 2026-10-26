import { it, expect } from "vitest";
import { pickZone, velocityToGain } from "../../src/music/zones";

const zones = [{ midi: 60 }, { midi: 64 }, { midi: 67 }];
it("exact zone plays at rate 1", () => expect(pickZone(zones, 64)).toEqual({ index: 1, rate: 1 }));
it("two semitones above a zone", () => {
  const z = pickZone(zones, 69);
  expect(z.index).toBe(2);
  expect(z.rate).toBeCloseTo(1.1225, 4);
});
it("ties go to the higher zone", () => expect(pickZone(zones, 62).index).toBe(1));
it("velocityToGain", () => {
  expect(velocityToGain(0)).toBe(0.2);
  expect(velocityToGain(1)).toBe(1);
  expect(velocityToGain(1.5)).toBe(1);
});
