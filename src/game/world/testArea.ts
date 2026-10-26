export const TILE = 16;
/** 0 empty, 1 solid ground, 2 one-way platform */
export type TileKind = 0 | 1 | 2;

export interface TestAreaLayout {
  width: number;
  height: number;
  tiles: TileKind[][];
  spawn: { x: number; y: number };
}

const WIDTH = 60;
const HEIGHT = 17;
const GROUND_ROW = 15;

// [row, firstCol, lastCol]
const PLATFORMS: [number, number, number][] = [
  [12, 8, 12],
  [10, 15, 19],
  [12, 24, 28],
  [9, 32, 37],
  [11, 42, 45],
  [12, 48, 53],
  [9, 50, 55],
];

export function buildTestArea(): TestAreaLayout {
  const tiles: TileKind[][] = Array.from({ length: HEIGHT }, () => Array<TileKind>(WIDTH).fill(0));
  for (let r = GROUND_ROW; r < HEIGHT; r++) tiles[r]!.fill(1);
  for (const [row, a, b] of PLATFORMS) for (let c = a; c <= b; c++) tiles[row]![c] = 2;
  return {
    width: WIDTH,
    height: HEIGHT,
    tiles,
    // Sprite is 24 px tall with 4 px of padding below the feet; center sits 12 px above the ground top.
    spawn: { x: 3 * TILE + 8, y: GROUND_ROW * TILE - 12 - 2 },
  };
}
