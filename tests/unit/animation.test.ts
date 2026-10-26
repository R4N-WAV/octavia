import { it, expect } from "vitest";
import { runFrameAtBeat, chooseAnim } from "../../src/game/player/animation";

it("run frames follow the beat; contacts at 0 and 4", () => {
  expect(runFrameAtBeat(0)).toBe(0);
  expect(runFrameAtBeat(0.5)).toBe(4);
  expect(runFrameAtBeat(0.99)).toBe(7);
  expect(runFrameAtBeat(1.0)).toBe(0);
  expect(runFrameAtBeat(-0.125)).toBe(7);
});
it("chooseAnim covers all states", () => {
  expect(chooseAnim({ grounded: false, vx: 0, vy: -50, msSinceLanding: 999 })).toBe("rise");
  expect(chooseAnim({ grounded: false, vx: 0, vy: 50, msSinceLanding: 999 })).toBe("fall");
  expect(chooseAnim({ grounded: true, vx: 0, vy: 0, msSinceLanding: 20 })).toBe("land");
  expect(chooseAnim({ grounded: true, vx: 100, vy: 0, msSinceLanding: 500 })).toBe("run");
  expect(chooseAnim({ grounded: true, vx: 0, vy: 0, msSinceLanding: 500 })).toBe("idle");
});
