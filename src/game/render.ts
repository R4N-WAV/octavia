export const BASE_W = 480;
export const BASE_H = 270;

export function integerZoom(windowW: number, windowH: number, baseW = BASE_W, baseH = BASE_H): number {
  return Math.max(1, Math.floor(Math.min(windowW / baseW, windowH / baseH)));
}

/**
 * Display size for the game canvas. Whole-number zoom when the screen allows 2x or more
 * (crisp pixels on desktops); on small screens (phones) scale to fill the space instead.
 */
export function fitSize(windowW: number, windowH: number, baseW = BASE_W, baseH = BASE_H): { width: number; height: number } {
  const fit = Math.min(windowW / baseW, windowH / baseH);
  const scale = fit >= 2 ? Math.floor(fit) : fit;
  return { width: Math.floor(baseW * scale), height: Math.floor(baseH * scale) };
}
