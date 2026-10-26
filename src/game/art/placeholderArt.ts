import Phaser from "phaser";
import { RUN_FRAMES } from "../player/animation";

// Dusk-countryside placeholder palette. Real art arrives in Step 4.
const C = {
  skyTop: "#232d55", skyMid: "#7a5c8e", skyLow: "#f0a97a",
  forest: "#1d2840", hills: "#2c4650",
  grassTop: "#74b84f", grass: "#4f8f3a", dirt: "#6b4a34", dirtDark: "#54382a",
  plank: "#b07a42", plankDark: "#7d5128",
  body: "#5fd6c6", bodyDark: "#35998f", scarf: "#e0539a", skin: "#f3e3c8", outline: "#12161f",
};

export const PLAYER_FRAME_W = 16;
export const PLAYER_FRAME_H = 24;
export const TILE_INDEX = { grass: 0, dirt: 1, plank: 2 } as const;

function canvas(scene: Phaser.Scene, key: string, w: number, h: number): CanvasRenderingContext2D {
  const tex = scene.textures.createCanvas(key, w, h)!;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

interface Pose { sxA: number; liftA: number; sxB: number; liftB: number; bodyDy: number }

function drawFigure(ctx: CanvasRenderingContext2D, ox: number, p: Pose): void {
  const r = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(ox + x, y, w, h); };
  const dy = p.bodyDy;
  // legs (back leg first)
  r(6 + p.sxB, 17 + dy - p.liftB, 2, 6 - dy + p.liftB, C.bodyDark);
  r(8 + p.sxA, 17 + dy - p.liftA, 2, 6 - dy + p.liftA, C.body);
  // body, head, scarf
  r(5, 9 + dy, 6, 9, C.body);
  r(5, 3 + dy, 6, 6, C.skin);
  r(9, 5 + dy, 1, 1, C.outline);
  r(3, 9 + dy, 9, 2, C.scarf);
  r(1, 10 + dy, 3, 2, C.scarf);
}

function buildPlayer(scene: Phaser.Scene): void {
  const names = ["idle", ...Array.from({ length: RUN_FRAMES }, (_, i) => `run${i}`), "rise", "fall", "land"];
  const ctx = canvas(scene, "player", PLAYER_FRAME_W * names.length, PLAYER_FRAME_H);
  names.forEach((name, i) => {
    const ox = i * PLAYER_FRAME_W;
    let pose: Pose = { sxA: 0, liftA: 0, sxB: 0, liftB: 0, bodyDy: 0 };
    if (name.startsWith("run")) {
      const phase = (Number(name.slice(3)) / RUN_FRAMES) * Math.PI * 2;
      pose = {
        sxA: Math.round(Math.cos(phase) * 3), liftA: Math.round(Math.max(0, -Math.sin(phase)) * 2),
        sxB: Math.round(-Math.cos(phase) * 3), liftB: Math.round(Math.max(0, Math.sin(phase)) * 2),
        bodyDy: -Math.round(Math.abs(Math.sin(phase))),
      };
    } else if (name === "rise") pose = { sxA: 1, liftA: 3, sxB: -1, liftB: 2, bodyDy: 0 };
    else if (name === "fall") pose = { sxA: 2, liftA: 1, sxB: -2, liftB: 1, bodyDy: 0 };
    else if (name === "land") pose = { sxA: 2, liftA: 0, sxB: -2, liftB: 0, bodyDy: 2 };
    drawFigure(ctx, ox, pose);
  });
  const tex = scene.textures.get("player");
  names.forEach((name, i) => tex.add(name, 0, i * PLAYER_FRAME_W, 0, PLAYER_FRAME_W, PLAYER_FRAME_H));
  (tex as Phaser.Textures.CanvasTexture).refresh();
}

function buildTiles(scene: Phaser.Scene): void {
  const ctx = canvas(scene, "tiles", 48, 16);
  const r = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  // grass-topped ground
  r(0, 0, 16, 16, C.dirt); r(0, 0, 16, 4, C.grass); r(0, 0, 16, 2, C.grassTop);
  for (const x of [2, 7, 12]) r(x, 4, 2, 2, C.grass);
  r(4, 9, 2, 2, C.dirtDark); r(11, 12, 2, 2, C.dirtDark);
  // dirt
  r(16, 0, 16, 16, C.dirt); r(20, 4, 2, 2, C.dirtDark); r(27, 10, 3, 2, C.dirtDark); r(18, 12, 2, 2, C.dirtDark);
  // wooden plank (one-way)
  r(32, 0, 16, 5, C.plank); r(32, 4, 16, 1, C.plankDark); r(35, 1, 1, 1, C.plankDark); r(42, 2, 1, 1, C.plankDark);
  (scene.textures.get("tiles") as Phaser.Textures.CanvasTexture).refresh();
}

function buildBackdrop(scene: Phaser.Scene): void {
  const sky = canvas(scene, "sky", 480, 270);
  const g = sky.createLinearGradient(0, 0, 0, 270);
  g.addColorStop(0, C.skyTop); g.addColorStop(0.55, C.skyMid); g.addColorStop(1, C.skyLow);
  sky.fillStyle = g; sky.fillRect(0, 0, 480, 270);
  (scene.textures.get("sky") as Phaser.Textures.CanvasTexture).refresh();

  // Seamless 480-wide strips: pseudo-random tree/hill silhouettes that wrap.
  const strip = (key: string, h: number, color: string, tree: boolean, seed: number) => {
    const ctx = canvas(scene, key, 480, h);
    ctx.fillStyle = color;
    let s = seed;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    if (tree) {
      for (let x = -8; x < 488; x += 10) {
        const th = 28 + rnd() * 34, tw = 12 + rnd() * 6;
        for (const wrapX of [x, x - 480]) {
          ctx.beginPath(); ctx.moveTo(wrapX, h); ctx.lineTo(wrapX + tw / 2, h - th); ctx.lineTo(wrapX + tw, h); ctx.fill();
        }
      }
      ctx.fillRect(0, h - 8, 480, 8);
    } else {
      for (let x = 0; x < 480; x++) {
        const y = h - 18 - Math.sin((x / 480) * Math.PI * 4) * 10 - Math.sin((x / 480) * Math.PI * 10) * 3;
        ctx.fillRect(x, y, 1, h - y);
      }
    }
    (scene.textures.get(key) as Phaser.Textures.CanvasTexture).refresh();
  };
  strip("forest", 90, C.forest, true, 7);
  strip("hills", 60, C.hills, false, 3);
}

export function generatePlaceholderArt(scene: Phaser.Scene): void {
  buildPlayer(scene);
  buildTiles(scene);
  buildBackdrop(scene);
}
