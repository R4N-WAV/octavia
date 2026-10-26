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

import { fitSize } from "../../src/game/render";
describe("fitSize", () => {
  it("uses whole-number zoom on large screens", () => expect(fitSize(1920, 1080)).toEqual({ width: 1920, height: 1080 }));
  it("keeps 2x on a laptop", () => expect(fitSize(1366, 768)).toEqual({ width: 960, height: 540 }));
  it("fills a landscape phone", () => expect(fitSize(844, 390)).toEqual({ width: 693, height: 390 }));
  it("fits a portrait phone's width", () => expect(fitSize(390, 844)).toEqual({ width: 390, height: 219 }));
});
