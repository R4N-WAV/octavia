export const BASE_W = 480;
export const BASE_H = 270;

export function integerZoom(windowW: number, windowH: number, baseW = BASE_W, baseH = BASE_H): number {
  return Math.max(1, Math.floor(Math.min(windowW / baseW, windowH / baseH)));
}
