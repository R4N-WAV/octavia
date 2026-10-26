import { it, expect } from "vitest";
import { InputState } from "../../src/game/input/inputState";

const pad = (axes: number[], pressed: number[] = []) => ({
  axes, timestamp: 0, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })),
});

it("maps keys to actions", () => {
  const s = new InputState();
  expect(s.handleKey("ArrowLeft", true, 1)).toBe(true);
  expect(s.isDown("left")).toBe(true);
  expect(s.axisX()).toBe(-1);
});
it("key repeat while held produces no extra edge", () => {
  const s = new InputState();
  s.handleKey("Space", true, 1);
  s.handleKey("Space", true, 2);
  expect(s.drainEdges()).toEqual([{ action: "jump", pressed: true, timeMs: 1 }]);
});
it("edges carry timestamps in order", () => {
  const s = new InputState();
  s.handleKey("KeyD", true, 10);
  s.handleKey("Space", true, 20);
  s.handleKey("Space", false, 30);
  expect(s.drainEdges().map((e) => [e.action, e.pressed, e.timeMs])).toEqual([["right", true, 10], ["jump", true, 20], ["jump", false, 30]]);
  expect(s.drainEdges()).toEqual([]);
});
it("left+right cancels axisX", () => {
  const s = new InputState();
  s.handleKey("ArrowLeft", true, 1);
  s.handleKey("ArrowRight", true, 2);
  expect(s.axisX()).toBe(0);
});
it("key and gamepad holding jump together release only when both let go", () => {
  const s = new InputState();
  s.handleKey("Space", true, 1);
  s.pollGamepad(pad([0, 0], [0]), 2);
  s.drainEdges();
  s.handleKey("Space", false, 3);
  expect(s.isDown("jump")).toBe(true);
  expect(s.drainEdges()).toEqual([]);
  s.pollGamepad(pad([0, 0]), 4);
  expect(s.drainEdges()).toEqual([{ action: "jump", pressed: false, timeMs: 4 }]);
});
it("gamepad stick dead zone", () => {
  const s = new InputState();
  s.pollGamepad(pad([-0.3, 0]), 1);
  expect(s.isDown("left")).toBe(false);
  s.pollGamepad(pad([-0.5, 0]), 2);
  expect(s.isDown("left")).toBe(true);
});
it("unmapped key returns false", () => expect(new InputState().handleKey("KeyQ", true, 1)).toBe(false));

it("touch buttons and keys combine like any other source", () => {
  const s = new InputState();
  s.handleButton("touch:right", "right", true, 1);
  s.handleKey("ArrowRight", true, 2);
  s.handleButton("touch:right", "right", false, 3);
  expect(s.isDown("right")).toBe(true);
  expect(s.drainEdges()).toEqual([{ action: "right", pressed: true, timeMs: 1 }]);
});
