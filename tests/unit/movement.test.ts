import { it, expect } from "vitest";
import { DEFAULT_MOVEMENT as P, JumpLogic, simulateJump, stepHorizontal, stepVertical, applyJumpCut } from "../../src/game/player/movement";

const dt = 1 / 60;

it("full jump ≈ 56 px", () => {
  const r = simulateJump(P, 999);
  expect(r.apexHeight).toBeGreaterThanOrEqual(52);
  expect(r.apexHeight).toBeLessThanOrEqual(60);
});
it("full jump air time ≈ 0.6 s", () => {
  const r = simulateJump(P, 999);
  expect(r.airTimeSec).toBeGreaterThan(0.52);
  expect(r.airTimeSec).toBeLessThan(0.68);
});
it("tap = short hop ≈ 18 px", () => {
  const r = simulateJump(P, 1);
  expect(r.apexHeight).toBeGreaterThanOrEqual(14);
  expect(r.apexHeight).toBeLessThanOrEqual(22);
});
it("reaches max run speed in ~0.08 s and never exceeds it", () => {
  let vx = 0;
  for (let i = 0; i < 5; i++) { vx = stepHorizontal(vx, 1, true, dt, P); expect(vx).toBeLessThanOrEqual(150); }
  expect(vx).toBeGreaterThanOrEqual(140);
});
it("stops in ~0.06 s", () => {
  let vx = 150;
  for (let i = 0; i < 4; i++) vx = stepHorizontal(vx, 0, true, dt, P);
  expect(vx).toBe(0);
});
it("air control is 65 %", () => {
  expect(stepHorizontal(0, 1, false, dt, P)).toBeCloseTo(stepHorizontal(0, 1, true, dt, P) * 0.65, 6);
});
it("fall speed clamps at 330", () => {
  let vy = 0;
  for (let i = 0; i < 200; i++) vy = stepVertical(vy, false, dt, P);
  expect(vy).toBe(330);
});
it("jump cut only slows a fast rise", () => {
  expect(applyJumpCut(-300, P)).toBe(-160);
  expect(applyJumpCut(-100, P)).toBe(-100);
});

const ground = { grounded: true, downHeld: false, onOneWay: false };
const air = { grounded: false, downHeld: false, onOneWay: false };

it("coyote jump works 90 ms after leaving the edge, not 110 ms", () => {
  const a = new JumpLogic(P);
  a.update(ground, 0);
  a.press(90);
  expect(a.update(air, 90)).toMatchObject({ kind: "jump", coyote: true });
  const b = new JumpLogic(P);
  b.update(ground, 0);
  b.press(110);
  expect(b.update(air, 110)).toEqual({ kind: "none" });
});
it("buffered press 100 ms before landing jumps on landing, 130 ms does not", () => {
  const a = new JumpLogic(P);
  a.press(0);
  expect(a.update(air, 50)).toEqual({ kind: "none" });
  expect(a.update(ground, 100)).toMatchObject({ kind: "jump", buffered: true });
  const b = new JumpLogic(P);
  b.press(0);
  b.update(air, 60);
  expect(b.update(ground, 130)).toEqual({ kind: "none" });
});
it("mid-air press outside buffer does nothing", () => {
  const j = new JumpLogic(P);
  j.update(ground, 0);
  j.update(air, 500);
  j.press(500);
  expect(j.update(air, 500)).toEqual({ kind: "none" });
});
it("held jump does not re-trigger on landing", () => {
  const j = new JumpLogic(P);
  j.press(0);
  expect(j.update(ground, 0).kind).toBe("jump");
  j.update(air, 100);
  expect(j.update(ground, 700)).toEqual({ kind: "none" });
});
it("no double jump via coyote right after jumping", () => {
  const j = new JumpLogic(P);
  j.press(0);
  expect(j.update(ground, 0).kind).toBe("jump");
  j.press(30);
  expect(j.update(air, 30)).toEqual({ kind: "none" });
});
it("down + jump on one-way → dropThrough; on solid ground → jump", () => {
  const a = new JumpLogic(P);
  a.press(0);
  expect(a.update({ grounded: true, downHeld: true, onOneWay: true }, 0)).toEqual({ kind: "dropThrough" });
  const b = new JumpLogic(P);
  b.press(0);
  expect(b.update({ grounded: true, downHeld: true, onOneWay: false }, 0).kind).toBe("jump");
});
