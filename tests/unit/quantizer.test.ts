import { it, expect } from "vitest";
import { quantize, strengthAt, Strength, ALL_SUBDIVISIONS as all } from "../../src/music/quantizer";

const spb = 0.625; // 96 BPM
const bar = 4;

it("late grace: 20 ms after the beat plays on the beat", () => {
  expect(quantize(1 + 0.02 / spb, spb, all, bar)).toMatchObject({ beat: 1, mode: "grace", strength: Strength.Beat });
});
it("strong pull: 35 ms before an eighth snaps to it", () => {
  expect(quantize(0.5 - 0.035 / spb, spb, all, bar)).toMatchObject({ beat: 0.5, mode: "pull" });
});
it("forward: otherwise snaps to the nearest upcoming point", () => {
  expect(quantize(0.22, spb, all, bar)).toMatchObject({ beat: 0.25, mode: "forward" });
});
it("triplets and straight points mix", () => expect(quantize(0.3, spb, all, bar).beat).toBeCloseTo(1 / 3, 9));
it("bar downbeat has Bar strength", () => expect(strengthAt(8, 4)).toBe(Strength.Bar));
it("never waits more than 1/8 beat with the full grid", () => {
  for (let i = 0; i < 5000; i++) {
    const x = i * 0.0137;
    const r = quantize(x, spb, all, bar);
    expect(r.beat - x).toBeLessThanOrEqual(0.125 + 1e-9);
    expect(r.beat - x).toBeGreaterThanOrEqual(-0.03 / spb - 1e-9);
  }
});
it("coarser grid snaps only to its own points", () => expect(quantize(0.6, spb, ["eighth"], bar).beat).toBe(1));
it("works for negative beats (count-in)", () => expect(quantize(-0.2, spb, ["eighth"], bar).beat).toBe(0));
