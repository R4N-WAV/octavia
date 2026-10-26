import { it, expect } from "vitest";
import { ManualTickSource } from "@audiorective/clock";
import { MusicClock, BeatTracker, heardTimeOfInput } from "../../src/music/clock";

function setup(bpm = 96) {
  const ctx = { currentTime: 0 };
  const tickSource = new ManualTickSource();
  const clock = new MusicClock({ context: ctx, perceivedTime: () => ctx.currentTime, bpm, beatsPerBar: 4, loopBars: 8, tickSource });
  const run = (to: number, step = 0.05) => {
    for (let t = ctx.currentTime; t <= to + 1e-9; t += step) {
      ctx.currentTime = t;
      tickSource.tick();
    }
  };
  return { ctx, tickSource, clock, run };
}

it("beatToTime/timeToBeat round-trip at 96 BPM", () => {
  const { clock } = setup();
  clock.start();
  expect(clock.beatToTime(4)).toBeCloseTo(2.5, 9);
  expect(clock.timeToBeat(2.5)).toBeCloseTo(4, 9);
});
it("windows deliver eighth points exactly once", () => {
  const { clock, run } = setup();
  const beats: number[] = [];
  clock.onWindow((w) => beats.push(...w.grid(8).map((p) => p.beat)));
  clock.start();
  run(5);
  expect(beats).toEqual(Array.from({ length: 17 }, (_, i) => i * 0.5));
});
it("loopStep wraps every 8 bars", () => {
  const { clock, run } = setup();
  const steps = new Map<number, number>();
  clock.onWindow((w) => w.grid(8).forEach((p) => steps.set(p.beat, p.loopStep)));
  clock.start();
  run(20.5);
  expect(steps.get(32)).toBe(0);
  expect(steps.get(32.5)).toBe(1);
  expect(steps.get(31.5)).toBe(63);
});
it("setBpm keeps beat position continuous", () => {
  const { ctx, clock, run } = setup();
  clock.start();
  run(1);
  ctx.currentTime = 1;
  const before = clock.timeToBeat(1);
  clock.setBpm(120);
  expect(clock.timeToBeat(1)).toBeCloseTo(before, 9);
  expect(clock.timeToBeat(1.5)).toBeCloseTo(before + 1, 9);
  expect(clock.bpm).toBe(120);
});
it("pause/resume preserves beat position", () => {
  const { ctx, tickSource, clock, run } = setup();
  clock.start();
  run(1);
  ctx.currentTime = 1;
  const atPause = clock.timeToBeat(1);
  clock.pause();
  ctx.currentTime = 10;
  tickSource.tick();
  clock.resume();
  expect(clock.timeToBeat(10)).toBeCloseTo(atPause, 6);
});
it("BeatTracker emits beat and bar events in order", () => {
  const t = new BeatTracker(4);
  expect(t.update(0.9)).toEqual([]);
  expect(t.update(1.1)).toEqual([{ kind: "beat", beatIndex: 1 }]);
  expect(t.update(4.05)).toEqual([
    { kind: "beat", beatIndex: 2 },
    { kind: "beat", beatIndex: 3 },
    { kind: "beat", beatIndex: 4 },
    { kind: "bar", barIndex: 1, beatIndex: 4 },
  ]);
});
it("BeatTracker emits only the latest beat after a large gap", () => {
  const t = new BeatTracker(4);
  t.update(0.5);
  expect(t.update(40.2)).toEqual([{ kind: "beat", beatIndex: 40 }, { kind: "bar", barIndex: 10, beatIndex: 40 }]);
});
it("heardTimeOfInput subtracts elapsed time", () => expect(heardTimeOfInput(1000, 1016, 5)).toBeCloseTo(4.984, 9));
