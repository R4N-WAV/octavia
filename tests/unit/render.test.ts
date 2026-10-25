import { describe, it, expect } from "vitest";
import { integerZoom } from "../../src/game/render";

describe("integerZoom", () => {
  it("picks the largest whole multiple that fits", () => {
    expect(integerZoom(1920, 1080)).toBe(4);
    expect(integerZoom(1366, 768)).toBe(2);
    expect(integerZoom(2560, 1440)).toBe(5);
  });
  it("never goes below 1", () => expect(integerZoom(300, 200)).toBe(1));
});
