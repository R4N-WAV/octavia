import { it, expect } from "vitest";
import { buildTestArea, TILE } from "../../src/game/world/testArea";

const area = buildTestArea();

it("ground rows are fully solid", () => {
  for (const r of [15, 16]) expect(area.tiles[r]!.every((t) => t === 1)).toBe(true);
});
it("has at least four one-way platforms 3-6 tiles wide", () => {
  const runs: number[] = [];
  for (const row of area.tiles) {
    let n = 0;
    for (const t of [...row, 0]) {
      if (t === 2) n++;
      else { if (n) runs.push(n); n = 0; }
    }
  }
  expect(runs.length).toBeGreaterThanOrEqual(4);
  for (const n of runs) { expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(6); }
});
it("every platform has two empty rows above it", () => {
  area.tiles.forEach((row, r) => row.forEach((t, c) => {
    if (t === 2) { expect(area.tiles[r - 1]![c]).toBe(0); expect(area.tiles[r - 2]![c]).toBe(0); }
  }));
});
it("spawn is above ground on empty tiles", () => {
  const col = Math.floor(area.spawn.x / TILE), row = Math.floor(area.spawn.y / TILE);
  expect(area.tiles[row]![col]).toBe(0);
  expect(area.tiles[15]![col]).toBe(1);
  expect(area.spawn.y).toBeLessThan(15 * TILE);
});
